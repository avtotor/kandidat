import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { Readable } from "stream";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Папки данных относительно корня проекта (откуда запускают сервер)
const RESUMES_DIR = path.join(process.cwd(), "server", "data", "resumes");
const QUESTIONS_PATH = path.join(process.cwd(), "server", "data", "questions.json");
const PROMPT_FILE = path.join(process.cwd(), "server", "prompts", "resume-evaluation.txt");

async function getResumeEvaluationPrompt(): Promise<string> {
  try {
    return await fs.readFile(PROMPT_FILE, "utf-8");
  } catch {
    return "Оцените резюме разработчика C++. Дай оценку 0–100% и краткое обоснование.";
  }
}

/** Извлекает текст резюме по sessionId. Возвращает пустую строку, если нет файла или не удалось прочитать. */
async function getResumeTextForSession(sessionId: number): Promise<string> {
  const session = await storage.getSession(sessionId);
  if (!session?.resumePath) return "";
  const filePath = path.join(RESUMES_DIR, session.resumePath);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    return "";
  }
  const ext = path.extname(session.resumePath).toLowerCase();
  if (ext === ".txt") {
    return buf.toString("utf-8");
  }
  if (ext === ".pdf") {
    try {
      const pdfModule = await import("pdf-parse");
      const pdfParse = pdfModule.default ?? (pdfModule as { (buf: Buffer): Promise<{ text?: string }> });
      const data = await pdfParse(buf);
      return typeof data?.text === "string" ? data.text : "";
    } catch {
      return "";
    }
  }
  return buf.toString("utf-8");
}

type QuestionDef = {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  image?: string;
  code?: string;
};

type QuestionMap = Record<"cpp" | "stm32" | "data" | "ai", QuestionDef[]>;

async function loadQuestions(): Promise<QuestionMap> {
  const raw = await fs.readFile(QUESTIONS_PATH, "utf-8");
  return JSON.parse(raw) as QuestionMap;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Загружаем все вопросы из JSON (единый источник правды)
  const QUESTIONS = await loadQuestions();

  app.get(api.questions.counts.path, (_req, res) => {
    res.status(200).json({
      cpp: QUESTIONS.cpp.length,
      stm32: QUESTIONS.stm32.length,
      data: QUESTIONS.data.length,
      ai: QUESTIONS.ai.length,
    });
  });

  app.post(api.sessions.create.path, async (req, res) => {
    try {
      const input = api.sessions.create.input.parse(req.body);
      const session = await storage.createSession({ 
        role: input.role,
        skills: input.skills 
      });
      
      const roleQuestions = QUESTIONS[input.role].map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        image: q.image,
        code: q.code
      }));
      
      res.status(201).json({
        ...session,
        questions: roleQuestions
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.sessions.updateStatus.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.sessions.updateStatus.input.parse(req.body);
      
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const updated = await storage.updateSessionStatus(id, input.status);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.sessions.updateCandidate.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.sessions.updateCandidate.input.parse(req.body);

      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const updated = await storage.updateCandidate(id, input);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.sessions.uploadResume.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.sessions.uploadResume.input.parse(req.body);

      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      await fs.mkdir(RESUMES_DIR, { recursive: true });
      const ext = path.extname(input.fileName) || ".bin";
      const resumeFileName = `0x${id.toString(16).toUpperCase().padStart(4, "0")}${ext}`;
      const filePath = path.join(RESUMES_DIR, resumeFileName);

      if (session.resumePath) {
        const oldPath = path.join(RESUMES_DIR, session.resumePath);
        try {
          await fs.unlink(oldPath);
        } catch {
          // старый файл мог быть под другим именем — игнорируем
        }
      }

      const buffer = Buffer.from(input.file, "base64");
      await fs.writeFile(filePath, buffer);
      console.log("[resume] saved:", filePath);
      const updated = await storage.setSessionResume(id, resumeFileName);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get("/api/sessions/:id/resume", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const session = await storage.getSession(id);
      if (!session?.resumePath) {
        return res.status(404).json({ message: "Резюме не найдено" });
      }
      const filePath = path.join(RESUMES_DIR, session.resumePath);
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: "Файл резюме не найден" });
      }
      res.setHeader("Content-Disposition", `attachment; filename="${session.resumePath}"`);
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ message: "Ошибка при скачивании" });
    }
  });

  app.delete(api.sessions.delete.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      await storage.deleteSession(id);
      res.status(204).send();
    } catch (err) {
      throw err;
    }
  });

  app.post(api.answers.submit.path, async (req, res) => {
    try {
      const sessionId = Number(req.params.id);
      const input = api.answers.submit.input.parse(req.body);
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Find the question to check correctness
      const allQs = Object.values(QUESTIONS).flat();
      const question = allQs.find(q => q.id === input.questionId);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      const isCorrect = question.correctIndex === input.selectedIndex;
      
      const answer = await storage.submitAnswer({
        sessionId,
        questionId: input.questionId,
        questionText: question.text,
        answerText: question.options[input.selectedIndex],
        isCorrect,
        timeSpentSec: input.timeSpentSec ?? null,
      });
      
      res.status(201).json({
        isCorrect,
        correctIndex: question.correctIndex,
        answer
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.dashboard.list.path, async (req, res) => {
    const sessions = await storage.getDashboardSessions();
    res.status(200).json(sessions);
  });

  // Прокси для Ollama (избегаем CORS). При stream: true прокидываем поток ответа.
  // Промт по умолчанию берётся из server/prompts/resume-evaluation.txt
  // Если передан sessionId и у сессии есть резюме — текст резюме прикладывается к промту.
  app.post("/api/ollama/generate", async (req, res) => {
    try {
      const body = req.body as { model?: string; prompt?: string; stream?: boolean; sessionId?: number };
      const stream = body.stream ?? true;
      let prompt = (body.prompt ?? "").trim();
      if (!prompt) {
        prompt = await getResumeEvaluationPrompt();
      }
      const sessionId = body.sessionId != null ? Number(body.sessionId) : undefined;
      if (sessionId != null && !Number.isNaN(sessionId)) {
        const resumeText = await getResumeTextForSession(sessionId);
        if (resumeText.trim()) {
          prompt = prompt + "\n\n--- Резюме ---\n" + resumeText.trim();
        }
      }

      const abortController = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });

      const r = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.model ?? "gemma3:4b",
          prompt,
          stream,
        }),
        signal: abortController.signal,
      });
      if (!r.ok) {
        const errText = await r.text();
        return res.status(r.status).json({ message: errText || "Ollama error" });
      }
      if (stream) {
        if (!r.body) {
          return res.status(502).json({ message: "Ollama не вернул поток (stream)" });
        }
        res.setHeader("Content-Type", "application/x-ndjson");
        const nodeStream = Readable.fromWeb(r.body as import("stream").WebReadableStream);
        nodeStream.pipe(res);
        nodeStream.on("error", () => res.destroy());
        res.on("error", () => nodeStream.destroy());
        return;
      }
      const data = await r.json();
      res.status(200).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка соединения с Ollama";
      res.status(502).json({ message });
    }
  });

  return httpServer;
}
