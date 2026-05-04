import { Router } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable, chatMessagesTable, weakTopicsTable, studentProfilesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

async function getWeakTopicsContext(deviceId: string, subject: string): Promise<string> {
  const weak = await db.select().from(weakTopicsTable)
    .where(and(eq(weakTopicsTable.deviceId, deviceId), eq(weakTopicsTable.subject, subject)))
    .orderBy(desc(weakTopicsTable.errorCount))
    .limit(5);

  if (weak.length === 0) return "";

  const topics = weak.map((w) => `- ${w.topic} (asked ${w.errorCount} time${w.errorCount > 1 ? "s" : ""})`).join("\n");
  return `\nSTUDENT'S WEAK TOPICS (needs extra attention):\n${topics}\nPay special attention to these areas. When relevant, briefly reinforce them even if not directly asked.`;
}

async function recordWeakTopic(deviceId: string, subject: string, topic: string) {
  const [existing] = await db.select().from(weakTopicsTable)
    .where(and(eq(weakTopicsTable.deviceId, deviceId), eq(weakTopicsTable.subject, subject), eq(weakTopicsTable.topic, topic)));

  if (existing) {
    await db.update(weakTopicsTable)
      .set({ errorCount: existing.errorCount + 1, lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(weakTopicsTable.id, existing.id));
  } else {
    await db.insert(weakTopicsTable).values({ deviceId, subject, topic, errorCount: 1 });
  }
}

async function buildSystemPrompt(subject: string, grade: string, board: string, mode: string, deviceId: string, language?: string): Promise<string> {
  const subjectKey = subject.toLowerCase();
  const persona = SUBJECT_PERSONAS[subjectKey] ?? { name: `${subject} Tutor`, style: `You are an expert ${subject} teacher.` };
  const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS["ask"];
  const weakTopicsContext = await getWeakTopicsContext(deviceId, subject);

  let languageInstruction: string;
  if (language === "Hindi") {
    languageInstruction = "Always respond in Hindi (Devanagari script). Use simple, clear Hindi.";
  } else if (language === "Hinglish") {
    languageInstruction = "Always respond in Hinglish (mix of Hindi and English). Use casual, friendly Hinglish.";
  } else {
    languageInstruction = "Use simple English.";
  }

  return `You are ${persona.name} for a ${board} ${grade} student in India.

TEACHING STYLE: ${persona.style}

CURRENT MODE: ${modeInstruction}
${weakTopicsContext}
STRICT RULES:
- Only teach content within the ${board} ${grade} ${subject} syllabus. Do NOT go beyond the curriculum.
- If a question is outside the syllabus, politely say so and redirect to syllabus topics.
- Always encourage the student. Be warm, supportive, and patient.
- ${languageInstruction}
- Do NOT use emojis. Use numbered lists and clear formatting instead.
- Keep responses concise but complete. Avoid unnecessary repetition.
- If a student seems confused, break the explanation into smaller pieces.
- At the end of your response, if the student clearly struggled with a concept, made an error, or asked a question that reveals a gap in their understanding, add one line: "TOPIC: <topic name>" where topic is the specific concept they need to practice more. Do NOT add this line for simple questions they answered correctly or straightforward factual lookups.

You are their personal tutor — smart, patient, and always on their side.`;
}

async function verifySessionOwner(sessionId: number, deviceId: string) {
  const [session] = await db.select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.deviceId, deviceId)));
  return session ?? null;
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
  const deviceId = req.query["deviceId"] as string | undefined;

  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }

  const session = await verifySessionOwner(id, deviceId);
  if (!session) {
    res.status(404).json({ error: "Session not found or access denied" });
    return;
  }

  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);
  res.json({ ...session, messages });
});

router.delete("/tutor/sessions/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const deviceId = (req.query["deviceId"] ?? req.body?.deviceId) as string | undefined;

  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }

  const session = await verifySessionOwner(id, deviceId);
  if (!session) {
    res.status(404).json({ error: "Session not found or access denied" });
    return;
  }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id));
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.status(204).end();
});

router.post("/tutor/sessions/:id/messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const { content, deviceId, grade, board, subject, mode } = req.body;

  if (!content || !grade || !board || !subject || !mode || !deviceId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const session = await verifySessionOwner(id, deviceId);
  if (!session) {
    res.status(404).json({ error: "Session not found or access denied" });
    return;
  }

  await db.insert(chatMessagesTable).values({ sessionId: id, role: "user", content });

  const history = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);

  const [profile] = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, deviceId));
  const systemPrompt = await buildSystemPrompt(subject, grade, board, mode, deviceId, profile?.preferredLanguage ?? undefined);

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

  const topicMatch = fullResponse.match(/^TOPIC:\s*(.+)/m);
  if (topicMatch?.[1]) {
    await recordWeakTopic(deviceId, subject, topicMatch[1].trim());
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/tutor/sessions/:id/image-messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const { imageBase64, grade, board, subject, mode, deviceId } = req.body;

  if (!imageBase64 || !grade || !board || !subject || !mode || !deviceId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const session = await verifySessionOwner(id, deviceId);
  if (!session) {
    res.status(404).json({ error: "Session not found or access denied" });
    return;
  }

  const [profile] = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, deviceId));
  const systemPrompt = await buildSystemPrompt(subject, grade, board, mode, deviceId, profile?.preferredLanguage ?? undefined);
  const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const extractionStream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          {
            type: "text",
            text: `First, on a single line starting with "QUESTION: ", write out the exact question or problem visible in the image.
Then provide a complete step-by-step solution as my ${subject} tutor for a ${board} ${grade} student.
At the end, add "TOPIC: <topic name>" on its own line.`,
          },
        ],
      },
    ],
    stream: true,
  });

  for await (const chunk of extractionStream) {
    const chunkContent = chunk.choices[0]?.delta?.content;
    if (chunkContent) {
      fullResponse += chunkContent;
      res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
    }
  }

  const questionMatch = fullResponse.match(/^QUESTION:\s*(.+)/m);
  const extractedQuestion = questionMatch?.[1]?.trim() ?? `[Image question in ${subject}]`;

  const topicMatch = fullResponse.match(/^TOPIC:\s*(.+)/m);
  if (topicMatch?.[1]) {
    await recordWeakTopic(deviceId, subject, topicMatch[1].trim());
  }

  await db.insert(chatMessagesTable).values({ sessionId: id, role: "user", content: `[Image] ${extractedQuestion}` });
  await db.insert(chatMessagesTable).values({ sessionId: id, role: "assistant", content: fullResponse });
  await db.update(chatSessionsTable).set({ updatedAt: new Date() }).where(eq(chatSessionsTable.id, id));

  res.write(`data: ${JSON.stringify({ done: true, extractedQuestion })}\n\n`);
  res.end();
});

router.get("/tutor/weak-topics/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  const topics = await db.select().from(weakTopicsTable)
    .where(eq(weakTopicsTable.deviceId, deviceId))
    .orderBy(desc(weakTopicsTable.errorCount));
  res.json(topics);
});

export default router;
