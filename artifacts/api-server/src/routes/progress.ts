import { Router } from "express";
import { db } from "@workspace/db";
import { studentProgressTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const BADGES = [
  { id: "first_question", name: "First Step", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 1 },
  { id: "ten_questions", name: "Getting Started", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 10 },
  { id: "fifty_questions", name: "Curious Mind", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 50 },
  { id: "streak_3", name: "On Fire", condition: (p: typeof studentProgressTable.$inferSelect) => p.streak >= 3 },
  { id: "streak_7", name: "Weekly Warrior", condition: (p: typeof studentProgressTable.$inferSelect) => p.streak >= 7 },
  { id: "level_5", name: "Rising Scholar", condition: (p: typeof studentProgressTable.$inferSelect) => p.level >= 5 },
  { id: "level_10", name: "Knowledge Seeker", condition: (p: typeof studentProgressTable.$inferSelect) => p.level >= 10 },
];

function computeLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function checkAndAwardBadges(progress: typeof studentProgressTable.$inferSelect): string[] {
  const currentBadges = progress.badges ?? [];
  const newBadges = [...currentBadges];
  for (const badge of BADGES) {
    if (!currentBadges.includes(badge.id) && badge.condition(progress)) {
      newBadges.push(badge.id);
    }
  }
  return newBadges;
}

async function getOrCreateProgress(deviceId: string) {
  const [existing] = await db.select().from(studentProgressTable).where(eq(studentProgressTable.deviceId, deviceId));
  if (existing) return existing;
  const [created] = await db.insert(studentProgressTable)
    .values({ deviceId, totalXp: 0, level: 1, streak: 0, totalQuestions: 0, subjectBreakdown: [], badges: [] })
    .returning();
  return created;
}

router.get("/progress/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const progress = await getOrCreateProgress(deviceId);
  res.json(progress);
});

router.post("/progress/:deviceId/xp", async (req, res) => {
  const { deviceId } = req.params;
  const { xp, subject, reason } = req.body;

  if (!deviceId || !xp || !subject) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const progress = await getOrCreateProgress(deviceId);
  const newTotalXp = progress.totalXp + xp;
  const newLevel = computeLevel(newTotalXp);
  const newTotalQuestions = progress.totalQuestions + 1;

  const subjectBreakdown = [...(progress.subjectBreakdown ?? [])];
  const subjectIdx = subjectBreakdown.findIndex((s) => s.subject === subject);
  if (subjectIdx >= 0) {
    subjectBreakdown[subjectIdx] = {
      ...subjectBreakdown[subjectIdx],
      questionCount: (subjectBreakdown[subjectIdx]?.questionCount ?? 0) + 1,
      xp: (subjectBreakdown[subjectIdx]?.xp ?? 0) + xp,
    };
  } else {
    subjectBreakdown.push({ subject, questionCount: 1, xp });
  }

  const today = new Date().toISOString().split("T")[0];
  let newStreak = progress.streak;
  const lastDate = progress.lastStreakDate;
  if (lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (lastDate === yesterdayStr) {
      newStreak = progress.streak + 1;
    } else if (!lastDate) {
      newStreak = 1;
    } else {
      newStreak = 1;
    }
  }

  const updatedProgress = {
    ...progress,
    totalXp: newTotalXp,
    level: newLevel,
    streak: newStreak,
    totalQuestions: newTotalQuestions,
    subjectBreakdown,
    lastActiveAt: new Date(),
    lastStreakDate: today ?? "",
    updatedAt: new Date(),
  };

  const newBadges = checkAndAwardBadges(updatedProgress);

  const [updated] = await db.update(studentProgressTable)
    .set({
      totalXp: newTotalXp,
      level: newLevel,
      streak: newStreak,
      totalQuestions: newTotalQuestions,
      subjectBreakdown,
      badges: newBadges,
      lastActiveAt: new Date(),
      lastStreakDate: today ?? "",
      updatedAt: new Date(),
    })
    .where(eq(studentProgressTable.deviceId, deviceId))
    .returning();

  res.json(updated);
});

export default router;
