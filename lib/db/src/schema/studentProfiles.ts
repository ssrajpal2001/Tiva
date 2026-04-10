import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentProfilesTable = pgTable("student_profiles", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  board: text("board").notNull(),
  subjects: jsonb("subjects").$type<string[]>().notNull().default([]),
  goal: text("goal"),
  preferredLanguage: text("preferred_language").default("english"),
  voicePersonality: text("voice_personality").default("friendly"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudentProfileSchema = createInsertSchema(studentProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentProfile = z.infer<typeof insertStudentProfileSchema>;
export type StudentProfile = typeof studentProfilesTable.$inferSelect;
