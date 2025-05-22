import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin users table
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  password: true,
});

// Quizzes table
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  title: text("title").notNull(),
  timePerQuestion: integer("time_per_question").notNull().default(15),
  status: text("status").notNull().default("draft"), // draft, active, completed
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuizSchema = createInsertSchema(quizzes).pick({
  adminId: true,
  title: true,
  timePerQuestion: true,
  status: true,
  code: true,
});

// Questions table
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull(),
  text: text("text").notNull(),
  options: json("options").notNull(), // Array of option objects with text and isCorrect
  order: integer("order").notNull(),
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  quizId: true,
  text: true,
  options: true,
  order: true,
});

// Quiz participants (users)
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull(),
  alias: text("alias").notNull(),
  score: integer("score").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertParticipantSchema = createInsertSchema(participants).pick({
  quizId: true,
  alias: true,
  score: true,
});

// Participant answers
export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").notNull(),
  questionId: integer("question_id").notNull(),
  selectedOption: integer("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  responseTime: integer("response_time").notNull(), // in milliseconds
  score: integer("score").notNull(),
});

export const insertAnswerSchema = createInsertSchema(answers).pick({
  participantId: true,
  questionId: true,
  selectedOption: true,
  isCorrect: true,
  responseTime: true,
  score: true,
});

// Types
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

// Option type for use within questions
export type QuizOption = {
  id: number;
  text: string;
  isCorrect: boolean;
};

// Enums
export enum QuizStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  COMPLETED = "completed"
}
