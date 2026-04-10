import { Router } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable, chatMessagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SUBJECT_PERSONAS: Record<string, { name: string; style: string }> = {
  math: {
    name: "Math Tutor",
    style: "You are a precise, step-by-step Math teacher. Break every problem into clear numbered steps. Show all working. Use simple language. Verify your answer at the end. Never skip steps.",
  },
  science: {
    name: "Science Tutor",
    style: "You are an engaging Science teacher who uses real-world analogies and examples. Explain concepts from first principles. Connect new ideas to things students already know.",
  },
  physics: {
    name: "Physics Tutor",
    style: "You are a Physics teacher who is excellent at explaining abstract concepts with diagrams described in words, everyday analogies, and step-by-step equation derivations.",
  },
  chemistry: {
    name: "Chemistry Tutor",
    style: "You are a Chemistry teacher who explains reactions and concepts clearly, using mnemonics and real-world examples. Always show balanced equations.",
  },
  biology: {
    name: "Biology Tutor",
    style: "You are a Biology teacher who loves storytelling. Explain life processes like an adventure. Use diagrams described in words, comparisons, and relatable examples.",
  },
  english: {
    name: "English Tutor",
    style: "You are an English teacher focused on grammar, writing, and comprehension. Provide examples for grammar rules. Give constructive feedback on writing. Explain idioms and literary devices.",
  },
  history: {
    name: "History Tutor",
    style: "You are a History teacher who brings the past alive through storytelling. Explain events with causes, effects, and human impact. Make dates memorable with context.",
  },
  geography: {
    name: "Geography Tutor",
    style: "You are a Geography teacher who connects physical and human geography. Use visual descriptions. Help students understand maps, climate, and how geography shapes societies.",
  },
  "social studies": {
    name: "Social Studies Tutor",
    style: "You are a Social Studies teacher who connects civics, economics, history, and geography. Explain how society works with real examples from India and the world.",
  },
  "computer science": {
    name: "Computer Science Tutor",
    style: "You are a Computer Science teacher who explains programming concepts step-by-step with pseudocode and real code examples. Make algorithms visual and logical.",
  },
  economics: {
    name: "Economics Tutor",
    style: "You are an Economics teacher who uses real-world market examples to explain concepts. Connect theory to what students see in daily life.",
  },
};

const MODE_INSTRUCTIONS: Record<string, string> = {
  ask: "Answer the student's question clearly and thoroughly. Be encouraging.",
  homework: "Help the student solve this step-by-step. Guide them to understand, not just copy. Show all working.",
  "exam-prep": "Provide a concise, exam-ready answer. Include key points, formulas, and what examiners look for. Format clearly for revision.",
  revision: "Give a quick, memorable summary perfect for last-minute revision. Use bullet points, mnemonics, or key facts. Keep it scannable.",
};

function buildSystemPrompt(subject: string, grade: string, board: string, mode: string): string {
  const subjectKey = subject.toLowerCase();
  const persona = SUBJECT_PERSONAS[subjectKey] ?? { name: `${subject} Tutor`, style: `You are an expert ${subject} teacher.` };
  const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS["ask"];

  return `You are ${persona.name} for a ${board} ${grade} student in India.

TEACHING STYLE: ${persona.style}

CURRENT MODE: ${modeInstruction}

STRICT RULES:
- Only teach content within the ${board} ${grade} ${subject} syllabus. Do NOT go beyond the curriculum.
- If a question is outside the syllabus, politely say so and redirect to syllabus topics.
- Always encourage the student. Be warm, supportive, and patient.
- Use simple English. If the student writes in Hindi or Hinglish, respond in the same language.
- Do NOT use emojis. Use numbered lists and clear formatting instead.
- Keep responses concise but complete. Avoid unnecessary repetition.
- If a student seems confused, break the explanation into smaller pieces.

You are their personal tutor — smart, patient, and always on their side.`;
}

router.get("/tutor/sessions", async (req, res) => {
  const deviceId = req.query["deviceId"] as string;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const sessions = await db.select().from(chatSessionsTable)
    .where(eq(chatSessionsTable.deviceId, deviceId))
    .orderBy(desc(chatSessionsTable.updatedAt));
  res.json(sessions);
});

router.post("/tutor/sessions", async (req, res) => {
  const { deviceId, subject, mode, title, grade, board } = req.body;
  if (!deviceId || !subject || !mode || !title || !grade || !board) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [session] = await db.insert(chatSessionsTable)
    .values({ deviceId, subject, mode, title, grade, board })
    .returning();
  res.status(201).json(session);
});

router.get("/tutor/sessions/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);
  res.json({ ...session, messages });
});

router.delete("/tutor/sessions/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id));
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.status(204).end();
});

router.post("/tutor/sessions/:id/messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const { content, deviceId, grade, board, subject, mode } = req.body;

  if (!content || !grade || !board || !subject || !mode) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db.insert(chatMessagesTable).values({ sessionId: id, role: "user", content });

  const history = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);

  const systemPrompt = buildSystemPrompt(subject, grade, board, mode);

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const chunkContent = chunk.choices[0]?.delta?.content;
    if (chunkContent) {
      fullResponse += chunkContent;
      res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
    }
  }

  await db.insert(chatMessagesTable).values({ sessionId: id, role: "assistant", content: fullResponse });
  await db.update(chatSessionsTable).set({ updatedAt: new Date() }).where(eq(chatSessionsTable.id, id));

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/tutor/sessions/:id/image-messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const { imageBase64, grade, board, subject, mode } = req.body;

  if (!imageBase64 || !grade || !board || !subject || !mode) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const systemPrompt = buildSystemPrompt(subject, grade, board, mode);

  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  let extractedQuestion = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
          {
            type: "text",
            text: "Please first identify and state the question from this image, then provide a complete solution/explanation as my tutor.",
          },
        ],
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const chunkContent = chunk.choices[0]?.delta?.content;
    if (chunkContent) {
      fullResponse += chunkContent;
      res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
    }
  }

  extractedQuestion = `[Image question in ${subject}]`;
  await db.insert(chatMessagesTable).values({ sessionId: id, role: "user", content: extractedQuestion });
  await db.insert(chatMessagesTable).values({ sessionId: id, role: "assistant", content: fullResponse });
  await db.update(chatSessionsTable).set({ updatedAt: new Date() }).where(eq(chatSessionsTable.id, id));

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
