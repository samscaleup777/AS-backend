import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const studioSchema = z.object({
  title: z.string().trim().min(3).max(100),
  category: z.enum(["Photo Studio", "Sound Stage", "Podcast Room", "Music Suite", "Art Workshop"]),
  hourlyRate: z.coerce.number().positive().max(100000),
  securityDeposit: z.coerce.number().min(0).max(100000),
  maxCapacity: z.coerce.number().int().min(1).max(1000),
  location: z.string().trim().min(3).max(180),
  imageUrl: z.string().url(),
  gallery: z.array(z.string().url()).max(12).optional().default([]),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  overview: z.string().trim().min(30).max(5000),
});

router.get("/featured", async (_req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection("studios").find({}).sort({ createdAt: -1 }).limit(6).toArray();
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
});

router.get("/", (req, res, next) =>
  req.query.owner === "me" ? requireAuth(req, res, next) : next(),
  async (req, res, next) => {
    try {
      const db = await getDb();
      const filter: Record<string, unknown> = {};
      if (typeof req.query.category === "string" && req.query.category) filter.category = req.query.category;
      if (typeof req.query.q === "string" && req.query.q.trim()) {
        const q = req.query.q.trim().replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { title: { $regex: q, $options: "i" } },
          { location: { $regex: q, $options: "i" } },
        ];
      }
      if (req.query.owner === "me") {
        if (!req.user) return res.status(401).json({ message: "Sign in to view your listings." });
        filter.ownerEmail = req.user.email;
      }
      const data = await db.collection("studios").find(filter).sort({ createdAt: -1 }).limit(100).toArray();
      res.json({ data, total: data.length });
    } catch (error) { next(error); }
  },
);

router.get("/:id/reviews", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid studio ID." });
    const db = await getDb();
    const data = await db.collection("reviews").find({ studioId: id }).sort({ createdAt: -1 }).limit(30).toArray();
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid studio ID." });
    const db = await getDb();
    const data = await db.collection("studios").findOne({ _id: new ObjectId(id) });
    if (!data) return res.status(404).json({ message: "Studio not found." });
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = studioSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Please review the studio information.", issues: parsed.error.issues });
    const db = await getDb();
    const now = new Date();
    const doc = {
      ...parsed.data,
      ownerId: req.user!.id,
      ownerName: req.user!.name,
      ownerEmail: req.user!.email,
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("studios").insertOne(doc);
    res.status(201).json({ data: { ...doc, _id: result.insertedId } });
  } catch (error) { next(error); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid studio ID." });
    const parsed = studioSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Please review the updated information.", issues: parsed.error.issues });
    if (!Object.keys(parsed.data).length) return res.status(400).json({ message: "No changes were provided." });
    const db = await getDb();
    const result = await db.collection("studios").findOneAndUpdate(
      { _id: new ObjectId(id), ownerEmail: req.user!.email },
      { $set: { ...parsed.data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!result) return res.status(404).json({ message: "Studio not found or you do not own this listing." });
    res.json({ data: result });
  } catch (error) { next(error); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== "string" || !ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid studio ID." });
    const db = await getDb();
    const result = await db.collection("studios").deleteOne({ _id: new ObjectId(id), ownerEmail: req.user!.email });
    if (!result.deletedCount) return res.status(404).json({ message: "Studio not found or you do not own this listing." });
    res.json({ message: "Studio deleted." });
  } catch (error) { next(error); }
});

export default router;