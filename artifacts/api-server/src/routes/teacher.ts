import { Router } from "express";
import { db } from "@workspace/db";
import {
  teachersTable, classroomsTable, classroomStudentsTable,
  teacherUploadsTable, broadcastsTable
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import crypto from "node:crypto";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "tiva_salt").digest("hex");
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Teacher auth
router.post("/teacher/register", async (req, res) => {
  const { email, name, password, schoolId, subject, grade } = req.body as {
    email: string; name: string; password: string; schoolId?: string; subject?: string; grade?: string;
  };
  if (!email || !name || !password) {
    res.status(400).json({ error: "email, name, password required" });
    return;
  }
  const existing = await db.select().from(teachersTable).where(eq(teachersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const [teacher] = await db.insert(teachersTable)
    .values({ email, name, passwordHash: hashPassword(password), schoolId, subject, grade })
    .returning();
  res.status(201).json({ id: teacher!.id, name: teacher!.name, email: teacher!.email });
});

router.post("/teacher/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.email, email));
  if (!teacher || teacher.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  // Simple token: base64(teacherId:timestamp) — replace with JWT in production
  const token = Buffer.from(`${teacher.id}:${Date.now()}`).toString("base64");
  res.json({ token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
});

// Middleware to get teacher from token header
async function getTeacherFromToken(token: string): Promise<typeof teachersTable.$inferSelect | null> {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const teacherId = parseInt(decoded.split(":")[0] ?? "");
    if (isNaN(teacherId)) return null;
    const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, teacherId));
    return teacher ?? null;
  } catch {
    return null;
  }
}

// Classrooms
router.post("/teacher/classrooms", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, grade, board, subject } = req.body as { name: string; grade: string; board: string; subject: string };
  if (!name || !grade || !board || !subject) {
    res.status(400).json({ error: "name, grade, board, subject required" });
    return;
  }
  const [classroom] = await db.insert(classroomsTable)
    .values({ teacherId: teacher.id, name, grade, board, subject, inviteCode: generateInviteCode() })
    .returning();
  res.status(201).json(classroom);
});

router.get("/teacher/classrooms", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const classrooms = await db.select().from(classroomsTable)
    .where(eq(classroomsTable.teacherId, teacher.id))
    .orderBy(desc(classroomsTable.createdAt));
  res.json(classrooms);
});

router.get("/teacher/classrooms/:id/students", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");
  const students = await db.select().from(classroomStudentsTable)
    .where(eq(classroomStudentsTable.classroomId, id));
  res.json(students);
});

// Student joins classroom via invite code
router.post("/classroom/join", async (req, res) => {
  const { deviceId, inviteCode } = req.body as { deviceId: string; inviteCode: string };
  if (!deviceId || !inviteCode) {
    res.status(400).json({ error: "deviceId and inviteCode required" });
    return;
  }
  const [classroom] = await db.select().from(classroomsTable)
    .where(eq(classroomsTable.inviteCode, inviteCode.toUpperCase()));
  if (!classroom) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }
  // Upsert - don't add duplicate
  const existing = await db.select().from(classroomStudentsTable)
    .where(and(eq(classroomStudentsTable.classroomId, classroom.id), eq(classroomStudentsTable.deviceId, deviceId)));
  if (existing.length === 0) {
    await db.insert(classroomStudentsTable).values({ classroomId: classroom.id, deviceId });
  }
  res.json({ classroom: { id: classroom.id, name: classroom.name, subject: classroom.subject, grade: classroom.grade } });
});

// Teacher uploads
router.post("/teacher/uploads", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type, title, content, classroomId, subject, grade } = req.body as {
    type: string; title: string; content: string; classroomId?: number; subject?: string; grade?: string;
  };

  if (!type || !title || !content) {
    res.status(400).json({ error: "type, title, content required" });
    return;
  }

  let extractedText = "";

  // For YouTube links, extract video ID and create a summary prompt
  if (type === "youtube") {
    const videoIdMatch = content.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch?.[1];
    extractedText = videoId
      ? `YouTube video: ${title}. Video ID: ${videoId}. URL: ${content}`
      : `YouTube video: ${title}. URL: ${content}`;
  } else if (type === "note" || type === "summary") {
    extractedText = content;
  } else if (type === "pdf") {
    // For PDF: content is base64, extract text via AI vision
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extract all text content from this document. Return only the extracted text, no commentary." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${content}` } },
          ],
        }],
        max_tokens: 2000,
      });
      extractedText = response.choices[0]?.message?.content ?? "";
    } catch {
      extractedText = `Document: ${title}`;
    }
  }

  const [upload] = await db.insert(teacherUploadsTable)
    .values({ teacherId: teacher.id, type, title, content, classroomId, subject, grade, extractedText })
    .returning();

  res.status(201).json({ id: upload!.id, title: upload!.title, type: upload!.type });
});

router.get("/teacher/uploads", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const uploads = await db.select().from(teacherUploadsTable)
    .where(eq(teacherUploadsTable.teacherId, teacher.id))
    .orderBy(desc(teacherUploadsTable.createdAt));
  res.json(uploads.map((u) => ({ id: u.id, type: u.type, title: u.title, subject: u.subject, grade: u.grade, createdAt: u.createdAt })));
});

// Daily lesson summary
router.post("/teacher/lesson-summary", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { classroomId, subject, summary } = req.body as { classroomId: number; subject: string; summary: string };
  if (!classroomId || !subject || !summary) {
    res.status(400).json({ error: "classroomId, subject, summary required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const [upload] = await db.insert(teacherUploadsTable)
    .values({
      teacherId: teacher.id,
      type: "summary",
      title: `${subject} - ${today}`,
      content: summary,
      classroomId,
      subject,
      extractedText: summary,
    })
    .returning();

  res.status(201).json({ id: upload!.id, message: "Lesson summary saved" });
});

// Student: get today's lesson for their classroom
router.get("/classroom/:classroomId/today-lesson", async (req, res) => {
  const classroomId = parseInt(req.params["classroomId"] ?? "");
  const today = new Date().toISOString().split("T")[0];

  const summaries = await db.select().from(teacherUploadsTable)
    .where(and(
      eq(teacherUploadsTable.classroomId, classroomId),
      eq(teacherUploadsTable.type, "summary"),
    ))
    .orderBy(desc(teacherUploadsTable.createdAt))
    .limit(1);

  if (summaries.length === 0) {
    res.json({ summary: null, message: "No lesson summary posted today" });
    return;
  }

  const latest = summaries[0]!;
  const uploadDate = latest.createdAt.toISOString().split("T")[0];

  res.json({
    summary: uploadDate === today ? latest.extractedText : null,
    date: uploadDate,
    subject: latest.subject,
    message: uploadDate === today ? "Here's what was taught today" : `Last lesson was on ${uploadDate}`,
  });
});

// Broadcasts
router.post("/teacher/broadcast", async (req, res) => {
  const token = req.headers["x-teacher-token"] as string;
  const teacher = await getTeacherFromToken(token);
  if (!teacher) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { classroomId, title, message, link, type } = req.body as {
    classroomId?: number; title: string; message: string; link?: string; type?: string;
  };

  if (!title || !message) {
    res.status(400).json({ error: "title and message required" });
    return;
  }

  const [broadcast] = await db.insert(broadcastsTable)
    .values({ teacherId: teacher.id, classroomId, title, message, link, type: type ?? "announcement" })
    .returning();

  res.status(201).json(broadcast);
});

// Student: get broadcasts for their classrooms
router.get("/student/broadcasts", async (req, res) => {
  const deviceId = req.query["deviceId"] as string;
  if (!deviceId) { res.status(400).json({ error: "deviceId required" }); return; }

  // Get student's classrooms
  const studentClassrooms = await db.select().from(classroomStudentsTable)
    .where(eq(classroomStudentsTable.deviceId, deviceId));

  const classroomIds = studentClassrooms.map((sc) => sc.classroomId);

  if (classroomIds.length === 0) {
    res.json([]);
    return;
  }

  // Get recent broadcasts for those classrooms
  const allBroadcasts = await db.select().from(broadcastsTable)
    .orderBy(desc(broadcastsTable.sentAt))
    .limit(20);

  const relevant = allBroadcasts.filter((b) =>
    b.classroomId == null || classroomIds.includes(b.classroomId)
  );

  res.json(relevant);
});

export default router;
