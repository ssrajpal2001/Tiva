import { Router } from "express";
import type { WebSocket } from "ws";
import { db } from "@workspace/db";
import { callSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { handleCallWebSocket } from "../services/callService";

export { handleCallWebSocket };

const router = Router();

router.post("/call/start", async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }

  const [session] = await db.insert(callSessionsTable)
    .values({ deviceId, status: "active", initiatedBy: "student", transcript: [] })
    .returning();

  res.json({ sessionId: session!.id });
});

router.post("/call/:sessionId/end", async (req, res) => {
  const id = parseInt(req.params.sessionId ?? "");

  if (isNaN(id)) {
    res.status(400).json({ error: "invalid sessionId" });
    return;
  }

  await db.update(callSessionsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(callSessionsTable.id, id));

  res.json({ success: true });
});

router.get("/call/:sessionId", async (req, res) => {
  const id = parseInt(req.params.sessionId ?? "");

  if (isNaN(id)) {
    res.status(400).json({ error: "invalid sessionId" });
    return;
  }

  const [session] = await db.select().from(callSessionsTable).where(eq(callSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json(session);
});

export default router;
