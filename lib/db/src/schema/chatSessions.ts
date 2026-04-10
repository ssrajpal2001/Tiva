import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  subject: text("subject").notNull(),
  mode: text("mode").notNull().default("ask"),
  title: text("title").notNull(),
  grade: text("grade").notNull(),
  board: text("board").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: serial("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
