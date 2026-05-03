import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testsTable = pgTable("tests", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull(), // "daily"|"weekly"|"monthly"|"yearly"|"revision"|"prev_year"
  grade: text("grade").notNull(),
  board: text("board").notNull(),
  status: text("status").notNull().default("pending"), // "pending"|"completed"|"abandoned"
  score: integer("score"),
  totalQuestions: integer("total_questions").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const testQuestionsTable = pgTable("test_questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => testsTable.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctAnswer: text("correct_answer").notNull(),
  studentAnswer: text("student_answer"),
  isCorrect: boolean("is_correct"),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  difficultyLevel: integer("difficulty_level").default(1),
  isWeakTopicQuestion: boolean("is_weak_topic_question").default(false),
  repeatCount: integer("repeat_count").default(0),
  nextRepeatAt: timestamp("next_repeat_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestSchema = createInsertSchema(testsTable).omit({ id: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof testsTable.$inferSelect;

export const insertTestQuestionSchema = createInsertSchema(testQuestionsTable).omit({ id: true });
export type InsertTestQuestion = z.infer<typeof insertTestQuestionSchema>;
export type TestQuestion = typeof testQuestionsTable.$inferSelect;
