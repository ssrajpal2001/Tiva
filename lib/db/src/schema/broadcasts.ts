import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  classroomId: integer("classroom_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"), // optional live session link
  type: text("type").notNull().default("announcement"), // "announcement"|"live_session"|"assignment"
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const insertBroadcastSchema = createInsertSchema(broadcastsTable).omit({ id: true });
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Broadcast = typeof broadcastsTable.$inferSelect;
