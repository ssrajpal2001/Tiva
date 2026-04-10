import { Router } from "express";
import { db } from "@workspace/db";
import { studentProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/profile", async (req, res) => {
  const deviceId = req.query["deviceId"] as string;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const [profile] = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, deviceId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.post("/profile", async (req, res) => {
  const { deviceId, name, grade, board, subjects, goal, preferredLanguage, voicePersonality } = req.body;
  if (!deviceId || !name || !grade || !board || !subjects) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const existing = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, deviceId));
  if (existing.length > 0) {
    const [updated] = await db.update(studentProfilesTable)
      .set({ name, grade, board, subjects, goal: goal ?? null, preferredLanguage: preferredLanguage ?? "english", voicePersonality: voicePersonality ?? "friendly", updatedAt: new Date() })
      .where(eq(studentProfilesTable.deviceId, deviceId))
      .returning();
    res.json(updated);
    return;
  }
  const [created] = await db.insert(studentProfilesTable)
    .values({ deviceId, name, grade, board, subjects, goal: goal ?? null, preferredLanguage: preferredLanguage ?? "english", voicePersonality: voicePersonality ?? "friendly" })
    .returning();
  res.json(created);
});

export default router;
