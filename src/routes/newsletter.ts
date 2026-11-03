import { Router } from "express";
import { z } from "zod";
import { getDb } from "../lib/db.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email().max(254) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email address." });
    const email = parsed.data.email.toLowerCase();
    const db = await getDb();
    await db.collection("newsletters").updateOne(
      { email },
      { $set: { email, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    res.status(201).json({ message: "Thanks for joining the StudioSpace newsletter." });
  } catch (error) { next(error); }
});

export default router;