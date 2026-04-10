import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weakTopicsTable = pgTable("weak_topics", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  errorCount: integer("error_count").notNull().default(1),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWeakTopicSchema = createInsertSchema(weakTopicsTable).omit({ id: true, lastSeenAt: true, updatedAt: true });
export type InsertWeakTopic = z.infer<typeof insertWeakTopicSchema>;
export type WeakTopic = typeof weakTopicsTable.$inferSelect;
