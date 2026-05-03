import { Router } from "express";
import { db } from "@workspace/db";
import { testsTable, testQuestionsTable, weakTopicsTable, studentProfilesTable } from "@workspace/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface GeneratedQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  topic: string;
  difficulty: number;
}

async function generateQuestionsWithAI(
  subject: string,
  grade: string,
  board: string,
  count: number,
  weakTopics: string[],
): Promise<GeneratedQuestion[]> {
  const weakSection = weakTopics.length > 0
    ? `Prioritize questions on these weak areas: ${weakTopics.join(", ")}. `
    : "";

  const prompt = `Generate exactly ${count} multiple-choice questions for a ${board} ${grade} ${subject} student.
${weakSection}
Return ONLY a JSON array with this exact structure (no markdown, no extra text):
[
  {
    "question": "question text",
    "optionA": "option A text",
    "optionB": "option B text",
    "optionC": "option C text",
    "optionD": "option D text",
    "correctAnswer": "A" or "B" or "C" or "D",
    "topic": "specific topic name",
    "difficulty": 1-3
  }
]
Make questions curriculum-appropriate and varied in difficulty.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content ?? "[]";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as GeneratedQuestion[];
}

router.post("/tests/generate", async (req, res) => {
  const { deviceId, subject, type, grade, board } = req.body as {
    deviceId: string;
    subject: string;
    type: string;
    grade: string;
    board: string;
  };

  if (!deviceId || !subject || !type || !grade || !board) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const questionCount = type === "daily" ? 5 : type === "weekly" ? 10 : type === "monthly" ? 20 : 15;

  const weakTopicRows = await db.select().from(weakTopicsTable)
    .where(and(eq(weakTopicsTable.deviceId, deviceId), eq(weakTopicsTable.subject, subject)))
    .limit(5);

  const weakTopics = weakTopicRows.map((w: { topic: string }) => w.topic);

  const questions = await generateQuestionsWithAI(subject, grade, board, questionCount, weakTopics);

  const [test] = await db.insert(testsTable)
    .values({ deviceId, subject, type, grade, board, status: "pending", totalQuestions: questions.length })
    .returning();

  const questionInserts = questions.map((q) => ({
    testId: test!.id,
    questionText: q.question,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    subject,
    topic: q.topic,
    difficultyLevel: q.difficulty,
    isWeakTopicQuestion: weakTopics.some((t: string) => q.topic.toLowerCase().includes(t.toLowerCase())),
  }));

  await db.insert(testQuestionsTable).values(questionInserts);

  res.status(201).json({ testId: test!.id, totalQuestions: questions.length });
});

router.get("/tests", async (req, res) => {
  const { deviceId, type } = req.query as { deviceId: string; type?: string };

  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }

  const conditions = [eq(testsTable.deviceId, deviceId)];
  if (type) conditions.push(eq(testsTable.type, type));

  const tests = await db.select().from(testsTable).where(and(...conditions));
  res.json(tests);
});

router.get("/tests/repeat-mistakes", async (req, res) => {
  const deviceId = req.query["deviceId"] as string;

  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }

  const now = new Date();
  const dueQuestions = await db.select().from(testQuestionsTable)
    .innerJoin(testsTable, eq(testQuestionsTable.testId, testsTable.id))
    .where(
      and(
        eq(testsTable.deviceId, deviceId),
        isNotNull(testQuestionsTable.nextRepeatAt),
        lte(testQuestionsTable.nextRepeatAt, now),
      ),
    )
    .limit(10);

  res.json(dueQuestions);
});

router.get("/tests/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");

  if (isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, id));

  if (!test) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const questions = await db.select().from(testQuestionsTable).where(eq(testQuestionsTable.testId, id));

  res.json({ ...test, questions });
});

router.post("/tests/:id/submit", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");
  const { answers } = req.body as { answers: Record<number, string> };

  if (isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const questions = await db.select().from(testQuestionsTable).where(eq(testQuestionsTable.testId, id));

  let score = 0;
  const updates: Promise<unknown>[] = [];

  for (const q of questions) {
    const studentAnswer = answers[q.id] ?? null;
    const isCorrect = studentAnswer === q.correctAnswer;

    if (isCorrect) score++;

    let nextRepeatAt: Date | null = null;
    let repeatCount = q.repeatCount ?? 0;

    if (!isCorrect) {
      repeatCount += 1;
      const daysUntilRepeat = Math.pow(2, repeatCount - 1);
      nextRepeatAt = new Date(Date.now() + daysUntilRepeat * 24 * 60 * 60 * 1000);
    } else if (q.nextRepeatAt) {
      // Correct on a repeat — stop scheduling
      nextRepeatAt = null;
    }

    updates.push(
      db.update(testQuestionsTable)
        .set({ studentAnswer, isCorrect, repeatCount, nextRepeatAt })
        .where(eq(testQuestionsTable.id, q.id)),
    );
  }

  await Promise.all(updates);

  await db.update(testsTable)
    .set({ status: "completed", score, completedAt: new Date() })
    .where(eq(testsTable.id, id));

  const percentage = Math.round((score / questions.length) * 100);
  const coinsEarned = percentage >= 80 ? 20 : percentage >= 60 ? 10 : 5;

  res.json({ score, total: questions.length, percentage, coinsEarned });
});

export default router;
