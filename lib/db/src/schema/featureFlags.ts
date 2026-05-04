import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  enabledForFree: boolean("enabled_for_free").notNull().default(true),
  enabledForPremium: boolean("enabled_for_premium").notNull().default(true),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlagsTable).omit({ id: true });
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
