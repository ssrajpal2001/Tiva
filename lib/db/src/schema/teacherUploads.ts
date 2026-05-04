import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teacherUploadsTable = pgTable("teacher_uploads", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  classroomId: integer("classroom_id"),
  type: text("type").notNull(), // "youtube"|"pdf"|"note"|"summary"
  title: text("title").notNull(),
  content: text("content").notNull(), // URL for youtube, text for notes/summary, base64 for pdf
  subject: text("subject"),
  grade: text("grade"),
  extractedText: text("extracted_text"), // processed text for AI context
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeacherUploadSchema = createInsertSchema(teacherUploadsTable).omit({ id: true });
export type InsertTeacherUpload = z.infer<typeof insertTeacherUploadSchema>;
export type TeacherUpload = typeof teacherUploadsTable.$inferSelect;
