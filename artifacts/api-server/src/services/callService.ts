import type { WebSocket } from "ws";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { studentProfilesTable, weakTopicsTable, callSessionsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface CallState {
  sessionId: string;
  deviceId: string;
  transcript: TranscriptEntry[];
  audioBuffer: Buffer[];
  silenceTimer: ReturnType<typeof setTimeout> | null;
  isTTSPlaying: boolean;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

const SILENCE_THRESHOLD_MS = 1200;

async function getStudentContext(deviceId: string): Promise<string> {
  const [profile] = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, deviceId));

  if (!profile) return "";

  const weakTopics = await db.select().from(weakTopicsTable)
    .where(eq(weakTopicsTable.deviceId, deviceId))
    .orderBy(desc(weakTopicsTable.errorCount))
    .limit(5);

  const weakList = weakTopics.length > 0
    ? `\nStudent's weak areas: ${weakTopics.map((w: { subject: string; topic: string }) => `${w.subject}/${w.topic}`).join(", ")}`
    : "";

  return `Student name: ${profile.name}, Grade: ${profile.grade}, Board: ${profile.board}${weakList}`;
}

function buildSystemPrompt(studentContext: string): string {
  return `You are TiVa, a friendly and knowledgeable AI mentor speaking on a voice call with a student. ${studentContext}

IMPORTANT VOICE CALL RULES:
- Keep responses SHORT (2-4 sentences max). This is a real-time voice conversation.
- Speak naturally and conversationally. No bullet points, no markdown, no formatting.
- Use natural speech patterns. You may use "hmm", "well", "you know" occasionally.
- Address the student by their first name sometimes to keep it personal.
- Be warm, encouraging, and patient — like a real tutor would be.
- If the student seems confused, offer to explain differently.
- End your turn clearly so the student knows it's their time to speak.`;
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  if (audioBuffer.length < 1000) return "";

  // Copy into a plain ArrayBuffer to satisfy Blob constructor strict typing
  const ab = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer;
  const audioBlob = new Blob([ab], { type: "audio/webm" });
  const audioFile = new File([audioBlob], "audio.webm", { type: "audio/webm" });

  const result = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: "en",
  });

  return result.text.trim();
}

async function generateResponse(
  userText: string,
  state: CallState,
  studentContext: string,
): Promise<string> {
  state.conversationHistory.push({ role: "user", content: userText });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: buildSystemPrompt(studentContext) },
      ...state.conversationHistory.slice(-10),
    ],
    max_tokens: 150,
    temperature: 0.8,
  });

  const assistantText = response.choices[0]?.message?.content ?? "I didn't catch that. Could you repeat?";
  state.conversationHistory.push({ role: "assistant", content: assistantText });

  return assistantText;
}

async function textToSpeech(text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    response_format: "mp3",
    speed: 1.0,
  });

  return Buffer.from(await response.arrayBuffer());
}

export async function handleCallWebSocket(ws: WebSocket, sessionId: string): Promise<void> {
  const [callSession] = await db.select().from(callSessionsTable).where(eq(callSessionsTable.id, parseInt(sessionId)));

  if (!callSession) {
    ws.close(1008, "Call session not found");
    return;
  }

  const studentContext = await getStudentContext(callSession.deviceId);

  const state: CallState = {
    sessionId,
    deviceId: callSession.deviceId,
    transcript: [],
    audioBuffer: [],
    silenceTimer: null,
    isTTSPlaying: false,
    conversationHistory: [],
  };

  // Send greeting after short delay
  setTimeout(async () => {
    try {
      const [profile] = await db.select().from(studentProfilesTable).where(eq(studentProfilesTable.deviceId, callSession.deviceId));
      const firstName = profile?.name?.split(" ")[0] ?? "there";
      const greeting = `Hey ${firstName}! This is TiVa. Great to connect with you. How's your studying going today?`;

      state.transcript.push({ role: "assistant", text: greeting, timestamp: new Date().toISOString() });
      state.conversationHistory.push({ role: "assistant", content: greeting });

      const audioBuffer = await textToSpeech(greeting);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "transcript", role: "assistant", text: greeting }));
        ws.send(audioBuffer);
      }
    } catch {
      // silently ignore greeting errors
    }
  }, 800);

  async function processAudioBuffer() {
    if (state.audioBuffer.length === 0) return;

    const combined = Buffer.concat(state.audioBuffer);
    state.audioBuffer = [];

    try {
      const transcript = await transcribeAudio(combined);
      if (!transcript) return;

      state.transcript.push({ role: "user", text: transcript, timestamp: new Date().toISOString() });

      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "transcript", role: "user", text: transcript }));
      }

      const responseText = await generateResponse(transcript, state, studentContext);

      state.transcript.push({ role: "assistant", text: responseText, timestamp: new Date().toISOString() });

      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "transcript", role: "assistant", text: responseText }));
        const audioResponse = await textToSpeech(responseText);
        ws.send(audioResponse);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing error";
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "error", message: msg }));
      }
    }
  }

  ws.on("message", (data) => {
    if (data instanceof Buffer || data instanceof ArrayBuffer) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      state.audioBuffer.push(buf);

      // Reset silence timer on each audio chunk
      if (state.silenceTimer) clearTimeout(state.silenceTimer);
      state.silenceTimer = setTimeout(() => {
        processAudioBuffer();
      }, SILENCE_THRESHOLD_MS);
    } else {
      // JSON control messages
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "end_call") {
          ws.close(1000, "Call ended by student");
        }
      } catch {
        // ignore malformed messages
      }
    }
  });

  ws.on("close", async () => {
    if (state.silenceTimer) clearTimeout(state.silenceTimer);

    await db.update(callSessionsTable)
      .set({
        status: "ended",
        transcript: state.transcript,
        endedAt: new Date(),
      })
      .where(eq(callSessionsTable.id, parseInt(sessionId)));
  });

  ws.on("error", () => {
    if (state.silenceTimer) clearTimeout(state.silenceTimer);
  });
}
