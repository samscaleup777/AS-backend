import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

// Every endpoint in this router requires a signed admin role and the API-side allowlist.
router.use(requireAuth, requireAdmin);

router.get("/me", (req, res) => {
  res.json({ data: { id: req.user!.id, name: req.user!.name, email: req.user!.email, role: "admin" } });
});

router.get("/overview", async (_req, res, next) => {
  try {
    const db = await getDb();
    const [users, studios, bookings, pendingBookings, confirmedBookings] = await Promise.all([
      db.collection("user").countDocuments({}),
      db.collection("studios").countDocuments({}),
      db.collection("bookings").countDocuments({}),
      db.collection("bookings").countDocuments({ status: "Pending" }),
      db.collection("bookings").countDocuments({ status: "Confirmed" }),
    ]);
    res.json({ data: { users, studios, bookings, pendingBookings, confirmedBookings } });
  } catch (error) { next(error); }
});

router.get("/users", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("user")
      .find({}, { projection: { name: 1, email: 1, image: 1, emailVerified: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/studios", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("studios")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/bookings", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("bookings")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.delete("/studios/:id", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid studio ID." });
    const db = await getDb();
    const result = await db.collection("studios").deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ message: "Studio not found." });
    return res.json({ message: "Studio listing deleted." });
  } catch (error) { return next(error); }
});

export default router;
