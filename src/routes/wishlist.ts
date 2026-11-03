import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const doc = await db.collection("wishlists").findOne({ userEmail: req.user!.email });
    res.json({ data: doc?.studioIds || [] });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = z.object({ studioId: z.string().refine(ObjectId.isValid) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid studio." });
    const db = await getDb();
    const studio = await db.collection("studios").findOne({ _id: new ObjectId(parsed.data.studioId) });
    if (!studio) return res.status(404).json({ message: "Studio not found." });
    const userEmail = req.user!.email;
    const existing = await db.collection("wishlists").findOne({ userEmail });
    const ids = (existing?.studioIds || []) as string[];
    const next = ids.includes(parsed.data.studioId)
      ? ids.filter((id) => id !== parsed.data.studioId)
      : [...ids, parsed.data.studioId];
    await db.collection("wishlists").updateOne(
      { userEmail },
      { $set: { studioIds: next, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    res.json({ data: next });
  } catch (error) { next(error); }
});

export default router;