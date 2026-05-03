import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const callSessionsTable = pgTable("call_sessions", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  status: text("status").notNull().default("active"),
  durationSeconds: integer("duration_seconds"),
  transcript: jsonb("transcript").$type<Array<{ role: string; text: string; timestamp: string }>>().default([]),
  initiatedBy: text("initiated_by").notNull().default("student"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const insertCallSessionSchema = createInsertSchema(callSessionsTable).omit({ id: true });
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessionsTable.$inferSelect;
