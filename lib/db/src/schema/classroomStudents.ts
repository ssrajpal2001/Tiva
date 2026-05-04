import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const classroomStudentsTable = pgTable("classroom_students", {
  id: serial("id").primaryKey(),
  classroomId: integer("classroom_id").notNull(),
  deviceId: text("device_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertClassroomStudentSchema = createInsertSchema(classroomStudentsTable).omit({ id: true });
export type InsertClassroomStudent = z.infer<typeof insertClassroomStudentSchema>;
export type ClassroomStudent = typeof classroomStudentsTable.$inferSelect;
