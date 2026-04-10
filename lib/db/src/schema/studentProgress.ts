import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentProgressTable = pgTable("student_progress", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  totalTimeMinutes: integer("total_time_minutes").notNull().default(0),
  subjectBreakdown: jsonb("subject_breakdown").$type<Array<{ subject: string; questionCount: number; xp: number; timeMinutes: number }>>().notNull().default([]),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  lastStreakDate: text("last_streak_date"),
  lastLoginXpDate: text("last_login_xp_date"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudentProgressSchema = createInsertSchema(studentProgressTable).omit({ id: true });
export type InsertStudentProgress = z.infer<typeof insertStudentProgressSchema>;
export type StudentProgress = typeof studentProgressTable.$inferSelect;
