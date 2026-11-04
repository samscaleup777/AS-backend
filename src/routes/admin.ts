import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

async function audit(req: Express.Request, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.collection("adminAudit").insertOne({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action,
    targetType,
    targetId,
    details,
    createdAt: new Date(),
  });
}

router.get("/me", (req, res) => {
  res.json({ data: { id: req.user!.id, name: req.user!.name, email: req.user!.email, role: "admin", twoFactorEnabled: true } });
});

router.get("/overview", async (_req, res, next) => {
  try {
    const db = await getDb();
    const [users, studios, bookings, pendingBookings, confirmedBookings, suspendedUsers, twoFactorUsers, recentAudit] = await Promise.all([
      db.collection("user").countDocuments({}),
      db.collection("studios").countDocuments({}),
      db.collection("bookings").countDocuments({}),
      db.collection("bookings").countDocuments({ status: "Pending" }),
      db.collection("bookings").countDocuments({ status: "Confirmed" }),
      db.collection("user").countDocuments({ adminAccessDisabled: true }),
      db.collection("user").countDocuments({ twoFactorEnabled: true }),
      db.collection("adminAudit").countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);
    res.json({ data: { users, studios, bookings, pendingBookings, confirmedBookings, suspendedUsers, twoFactorUsers, adminActionsLast7Days: recentAudit } });
  } catch (error) { next(error); }
});

router.get("/users", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("user")
      .find({}, { projection: { name: 1, email: 1, image: 1, emailVerified: 1, twoFactorEnabled: 1, adminAccessDisabled: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ createdAt: -1 }).limit(500).toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      suspended: z.boolean().optional(),
    }).strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Provide a valid name or account status." });
    const targetEmail = req.params.id.trim().toLowerCase();
    const protectedAdmins = new Set(
      (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    );
    if (parsed.data.suspended === true && protectedAdmins.has(targetEmail)) {
      return res.status(400).json({ message: "The two designated administrator identities cannot be suspended from member management." });
    }
    const db = await getDb();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) set.name = parsed.data.name;
    if (parsed.data.suspended !== undefined) set.adminAccessDisabled = parsed.data.suspended;
    const result = await db.collection("user").findOneAndUpdate(
      { email: req.params.id.trim().toLowerCase() },
      { $set: set },
      { returnDocument: "after", projection: { name: 1, email: 1, adminAccessDisabled: 1, twoFactorEnabled: 1 } },
    );
    if (!result) return res.status(404).json({ message: "User not found." });
    await audit(req, parsed.data.suspended === undefined ? "user.updated" : (parsed.data.suspended ? "user.suspended" : "user.restored"), "user", req.params.id, parsed.data);
    return res.json({ data: result });
  } catch (error) { return next(error); }
});

router.get("/studios", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("studios").find({}).sort({ createdAt: -1 }).limit(500).toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

const studioAdminSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  category: z.enum(["Photo Studio", "Sound Stage", "Podcast Room", "Music Suite", "Art Workshop"]).optional(),
  hourlyRate: z.coerce.number().positive().max(100000).optional(),
  securityDeposit: z.coerce.number().min(0).max(100000).optional(),
  maxCapacity: z.coerce.number().int().min(1).max(1000).optional(),
  location: z.string().trim().min(3).max(180).optional(),
  overview: z.string().trim().min(30).max(5000).optional(),
}).strict();

router.patch("/studios/:id", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid studio ID." });
    const parsed = studioAdminSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Provide valid studio fields to update." });
    const db = await getDb();
    const result = await db.collection("studios").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...parsed.data, moderatedBy: req.user!.email, moderatedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!result) return res.status(404).json({ message: "Studio not found." });
    await audit(req, "studio.updated", "studio", req.params.id, parsed.data);
    return res.json({ data: result });
  } catch (error) { return next(error); }
});

router.delete("/studios/:id", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid studio ID." });
    const db = await getDb();
    const result = await db.collection("studios").deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ message: "Studio not found." });
    await audit(req, "studio.deleted", "studio", req.params.id);
    return res.json({ message: "Studio listing deleted." });
  } catch (error) { return next(error); }
});

router.get("/bookings", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("bookings").find({}).sort({ createdAt: -1 }).limit(500).toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.patch("/bookings/:id/status", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const parsed = z.enum(["Pending", "Confirmed", "Cancelled", "Completed"]).safeParse(req.body.status);
    if (!parsed.success) return res.status(400).json({ message: "Unsupported booking status." });
    const db = await getDb();
    const current = await db.collection("bookings").findOne({ _id: new ObjectId(req.params.id) });
    if (!current) return res.status(404).json({ message: "Booking not found." });
    if (parsed.data === "Confirmed") {
      const overlap = await db.collection("bookings").findOne({
        _id: { $ne: current._id },
        studioId: current.studioId,
        date: current.date,
        status: "Confirmed",
        startTime: { $lt: current.endTime },
        endTime: { $gt: current.startTime },
      });
      if (overlap) return res.status(409).json({ message: "Another confirmed booking overlaps this time window." });
    }
    const updated = await db.collection("bookings").findOneAndUpdate(
      { _id: current._id },
      { $set: { status: parsed.data, updatedAt: new Date(), moderatedBy: req.user!.email } },
      { returnDocument: "after" },
    );
    await audit(req, "booking.status_changed", "booking", req.params.id, { from: current.status, to: parsed.data });
    return res.json({ data: updated });
  } catch (error) { return next(error); }
});

router.delete("/bookings/:id", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const db = await getDb();
    const result = await db.collection("bookings").deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ message: "Booking not found." });
    await audit(req, "booking.deleted", "booking", req.params.id);
    return res.json({ message: "Booking deleted." });
  } catch (error) { return next(error); }
});

router.get("/audit", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("adminAudit").find({}).sort({ createdAt: -1 }).limit(250).toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

export default router;
