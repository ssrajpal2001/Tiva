import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/openai/conversations", async (_req, res) => {
  const convs = await db.select().from(conversations);
  res.json(convs);
});

router.post("/openai/conversations", async (req, res) => {
  const { title } = req.body;
  const [conv] = await db.insert(conversations).values({ title }).returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "0");
  const { content } = req.body;

  if (!content) {
    res.status(400).json({ error: "content required" });
    return;
  }

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  const history = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  const chatMessages = history.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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
    const c = chunk.choices[0]?.delta?.content;
    if (c) {
      fullResponse += c;
      res.write(`data: ${JSON.stringify({ content: c })}\n\n`);
    }
  }

  await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
