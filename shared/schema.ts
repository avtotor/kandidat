import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'cpp' or 'stm32'
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed'
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  resumePath: text("resume_path"), // путь к загруженному резюме на сервере
  skills: json("skills").$type<{
    postgres: number;
    cpp: number;
    api: number;
    linux: number;
    llm: number;
    git: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  questionId: integer("question_id").notNull(),
  questionText: text("question_text").notNull(),
  answerText: text("answer_text").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  timeSpentSec: integer("time_spent_sec"), // секунды на ответ (опционально)
  createdAt: timestamp("created_at").defaultNow(),
});

// Base schemas
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, status: true });
export const insertAnswerSchema = createInsertSchema(answers).omit({ id: true, createdAt: true });

// Types
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

// API Contract Types
export type CreateSessionRequest = {
  role: 'cpp' | 'stm32' | 'data' | 'ai';
  skills?: {
    postgres: number;
    cpp: number;
    api: number;
    linux: number;
    llm: number;
    git: number;
  };
};

export type Question = {
  id: number;
  text: string;
  options: string[];
  image?: string;
  code?: string;
};

export type SessionResponse = Session & {
  questions: Question[];
};

export type SubmitAnswerRequest = {
  questionId: number;
  selectedIndex: number;
};

export type SubmitAnswerResponse = {
  isCorrect: boolean;
  correctIndex: number;
  answer: Answer;
};

export type DashboardSession = Session & {
  answers: Answer[];
};

export type DashboardResponse = DashboardSession[];
