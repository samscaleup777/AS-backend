import { randomUUID } from "node:crypto";
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { calculateBookingHours, calculateBookingTotal, isValidBookingDate, isValidTimeRange } from "../lib/booking-rules.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const bookingSchema = z.object({
  studioId: z.string().refine(ObjectId.isValid, "Invalid studio ID."),
  date: z.string().refine(isValidBookingDate, "Choose a valid booking date."),
  startTime: z.string(),
  endTime: z.string(),
});

class BookingConflictError extends Error {
  status = 409;
  constructor(message: string) { super(message); }
}

/** Serializes host confirmations for one studio/date across API instances. */
async function withStudioDateLock<T>(studioId: string, date: string, work: () => Promise<T>): Promise<T> {
  const db = await getDb();
  const locks = db.collection<{ _id: string; token: string; expiresAt: Date; updatedAt: Date }>("bookingLocks");
  const lockId = `${studioId}:${date}`;
  const token = randomUUID();
  const now = new Date();
  try {
    await locks.updateOne(
      { _id: lockId, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { token, expiresAt: new Date(now.getTime() + 120_000), updatedAt: now } },
      { upsert: true },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new BookingConflictError("Another booking for this studio and date is being confirmed. Please retry in a moment.");
    }
    throw error;
  }
  try {
    return await work();
  } finally {
    await locks.deleteOne({ _id: lockId, token });
  }
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose a studio, date and valid time window." });
    const { studioId, date, startTime, endTime } = parsed.data;
    if (!isValidTimeRange(startTime, endTime)) return res.status(400).json({ message: "End time must be later than start time. Use 24-hour time." });
    if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: "Bookings cannot be made in the past." });

    const db = await getDb();
    const studio = await db.collection("studios").findOne({ _id: new ObjectId(studioId) });
    if (!studio) return res.status(404).json({ message: "This studio is no longer available." });
    if (studio.ownerEmail?.toLowerCase() === req.user!.email) return res.status(400).json({ message: "You cannot book your own studio listing." });

    // Pending requests do not block a new request; only Confirmed reservations do.
    const collision = await db.collection("bookings").findOne({
      studioId, date, status: "Confirmed",
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });
    if (collision) return res.status(409).json({ message: "This studio is already confirmed for part of that time. Please choose another time window." });

    const hours = calculateBookingHours(startTime, endTime);
    const now = new Date();
    const doc = {
      studioId,
      studioTitle: studio.title,
      date,
      startTime,
      endTime,
      hours,
      hourlyRate: Number(studio.hourlyRate),
      securityDeposit: Number(studio.securityDeposit || 0),
      totalAmount: calculateBookingTotal(hours, Number(studio.hourlyRate), Number(studio.securityDeposit || 0)),
      status: "Pending" as const,
      customerId: req.user!.id,
      customerName: req.user!.name,
      customerEmail: req.user!.email,
      ownerEmail: String(studio.ownerEmail).toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("bookings").insertOne(doc);
    return res.status(201).json({ data: { ...doc, _id: result.insertedId } });
  } catch (error) { return next(error); }
});

router.get("/me", async (req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("bookings").find({ customerEmail: req.user!.email }).sort({ createdAt: -1 }).limit(100).toArray();
    return res.json({ data });
  } catch (error) { return next(error); }
});

router.get("/host", async (req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("bookings").find({ ownerEmail: req.user!.email }).sort({ createdAt: -1 }).limit(100).toArray();
    return res.json({ data });
  } catch (error) { return next(error); }
});

router.patch("/:id/cancel", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const db = await getDb();
    const result = await db.collection("bookings").findOneAndUpdate(
      { _id: new ObjectId(req.params.id), customerEmail: req.user!.email, status: "Pending" },
      { $set: { status: "Cancelled", updatedAt: new Date() } },
      { returnDocument: "after", includeResultMetadata: false },
    );
    if (!result) return res.status(409).json({ message: "Only your pending bookings can be cancelled." });
    return res.json({ data: result });
  } catch (error) { return next(error); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const parsedStatus = z.enum(["Confirmed", "Cancelled", "Completed"]).safeParse(req.body.status);
    if (!parsedStatus.success) return res.status(400).json({ message: "Unsupported booking status." });

    const db = await getDb();
    const bookingId = new ObjectId(req.params.id);
    const requestedStatus = parsedStatus.data;

    if (requestedStatus === "Confirmed") {
      const current = await db.collection("bookings").findOne({ _id: bookingId, ownerEmail: req.user!.email, status: "Pending" });
      if (!current) return res.status(404).json({ message: "Pending booking not found for this host." });
      const updated = await withStudioDateLock(String(current.studioId), String(current.date), async () => {
        const collision = await db.collection("bookings").findOne({
          _id: { $ne: bookingId },
          studioId: current.studioId,
          date: current.date,
          status: "Confirmed",
          startTime: { $lt: current.endTime },
          endTime: { $gt: current.startTime },
        });
        if (collision) throw new BookingConflictError("This request overlaps another confirmed booking. It cannot be confirmed.");
        return db.collection("bookings").findOneAndUpdate(
          { _id: bookingId, ownerEmail: req.user!.email, status: "Pending" },
          { $set: { status: "Confirmed", updatedAt: new Date() } },
          { returnDocument: "after", includeResultMetadata: false },
        );
      });
      if (!updated) return res.status(409).json({ message: "This booking was changed by another request. Refresh and try again." });
      return res.json({ data: updated });
    }

    const allowedCurrentStatuses = requestedStatus === "Completed" ? ["Confirmed"] : ["Pending", "Confirmed"];
    const updated = await db.collection("bookings").findOneAndUpdate(
      { _id: bookingId, ownerEmail: req.user!.email, status: { $in: allowedCurrentStatuses } },
      { $set: { status: requestedStatus, updatedAt: new Date() } },
      { returnDocument: "after", includeResultMetadata: false },
    );
    if (!updated) return res.status(409).json({ message: "This booking cannot transition to the requested status." });
    return res.json({ data: updated });
  } catch (error) {
    if (error instanceof BookingConflictError) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

export default router;