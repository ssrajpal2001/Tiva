import { Router } from "express";
import { db } from "@workspace/db";
import { studentProgressTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DAILY_LOGIN_XP = 5;

const BADGES = [
  { id: "first_question", name: "First Step", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 1 },
  { id: "ten_questions", name: "Getting Started", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 10 },
  { id: "fifty_questions", name: "Curious Mind", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalQuestions >= 50 },
  { id: "streak_3", name: "On Fire", condition: (p: typeof studentProgressTable.$inferSelect) => p.streak >= 3 },
  { id: "streak_7", name: "Weekly Warrior", condition: (p: typeof studentProgressTable.$inferSelect) => p.streak >= 7 },
  { id: "level_5", name: "Rising Scholar", condition: (p: typeof studentProgressTable.$inferSelect) => p.level >= 5 },
  { id: "level_10", name: "Knowledge Seeker", condition: (p: typeof studentProgressTable.$inferSelect) => p.level >= 10 },
  { id: "time_60", name: "Hour Scholar", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalTimeMinutes >= 60 },
  { id: "time_300", name: "Dedicated Learner", condition: (p: typeof studentProgressTable.$inferSelect) => p.totalTimeMinutes >= 300 },
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
    .values({ deviceId, totalXp: 0, level: 1, streak: 0, totalQuestions: 0, totalTimeMinutes: 0, subjectBreakdown: [], badges: [] })
    .returning();
  return created!;
}

router.get("/progress/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const progress = await getOrCreateProgress(deviceId);

  const today = new Date().toISOString().split("T")[0] ?? "";
  if (progress.lastLoginXpDate !== today) {
    const newTotalXp = progress.totalXp + DAILY_LOGIN_XP;
    const newLevel = computeLevel(newTotalXp);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0] ?? "";
    let newStreak = progress.streak;
    if (!progress.lastStreakDate) {
      newStreak = 1;
    } else if (progress.lastStreakDate === yesterdayStr) {
      newStreak = progress.streak + 1;
    } else if (progress.lastStreakDate !== today) {
      newStreak = 1;
    }

    const updatedProgress = { ...progress, totalXp: newTotalXp, level: newLevel, streak: newStreak };
    const newBadges = checkAndAwardBadges(updatedProgress);

    const [updated] = await db.update(studentProgressTable)
      .set({
        totalXp: newTotalXp,
        level: newLevel,
        streak: newStreak,
        badges: newBadges,
        lastActiveAt: new Date(),
        lastStreakDate: today,
        lastLoginXpDate: today,
        updatedAt: new Date(),
      })
      .where(eq(studentProgressTable.deviceId, deviceId))
      .returning();
    res.json(updated);
    return;
  }

  res.json(progress);
});

router.post("/progress/:deviceId/xp", async (req, res) => {
  const { deviceId } = req.params;
  const { xp, subject, reason, timeMinutes } = req.body;

  if (!deviceId || !xp || !subject) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const progress = await getOrCreateProgress(deviceId);
  const newTotalXp = progress.totalXp + xp;
  const newLevel = computeLevel(newTotalXp);
  const newTotalQuestions = reason === "chat_message" ? progress.totalQuestions + 1 : progress.totalQuestions;
  const addedMinutes = typeof timeMinutes === "number" ? timeMinutes : 0;
  const newTotalTimeMinutes = progress.totalTimeMinutes + addedMinutes;

  const subjectBreakdown = [...(progress.subjectBreakdown ?? [])];
  const subjectIdx = subjectBreakdown.findIndex((s) => s.subject === subject);
  if (subjectIdx >= 0 && subjectBreakdown[subjectIdx]) {
    subjectBreakdown[subjectIdx] = {
      ...subjectBreakdown[subjectIdx]!,
      questionCount: (subjectBreakdown[subjectIdx]?.questionCount ?? 0) + (reason === "chat_message" ? 1 : 0),
      xp: (subjectBreakdown[subjectIdx]?.xp ?? 0) + xp,
      timeMinutes: (subjectBreakdown[subjectIdx]?.timeMinutes ?? 0) + addedMinutes,
    };
  } else {
    subjectBreakdown.push({ subject, questionCount: reason === "chat_message" ? 1 : 0, xp, timeMinutes: addedMinutes });
  }

  const today = new Date().toISOString().split("T")[0] ?? "";
  let newStreak = progress.streak;
  const lastDate = progress.lastStreakDate;
  if (lastDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0] ?? "";
    if (lastDate === yesterdayStr) {
      newStreak = progress.streak + 1;
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
    totalTimeMinutes: newTotalTimeMinutes,
    subjectBreakdown,
  };

  const newBadges = checkAndAwardBadges(updatedProgress);

  const [updated] = await db.update(studentProgressTable)
    .set({
      totalXp: newTotalXp,
      level: newLevel,
      streak: newStreak,
      totalQuestions: newTotalQuestions,
      totalTimeMinutes: newTotalTimeMinutes,
      subjectBreakdown,
      badges: newBadges,
      lastActiveAt: new Date(),
      lastStreakDate: today,
      updatedAt: new Date(),
    })
    .where(eq(studentProgressTable.deviceId, deviceId))
    .returning();

  res.json(updated);
});

export default router;
