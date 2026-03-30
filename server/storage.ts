import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  Session,
  InsertSession,
  Answer,
  InsertAnswer,
  DashboardSession,
} from "@shared/schema";

export interface IStorage {
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  updateSessionStatus(id: number, status: string): Promise<Session>;
  updateCandidate(id: number, data: { firstName: string; lastName: string; phone: string }): Promise<Session>;
  setSessionResume(id: number, resumePath: string): Promise<Session>;
  deleteSession(id: number): Promise<void>;
  submitAnswer(answer: InsertAnswer): Promise<Answer>;
  getDashboardSessions(): Promise<DashboardSession[]>;
}

type PersistedSession = Omit<Session, "createdAt"> & { createdAt: string | null };
type PersistedAnswer = Omit<Answer, "createdAt"> & { createdAt: string | null };

type PersistedDb = {
  nextSessionId: number;
  nextAnswerId: number;
  sessions: PersistedSession[];
  answers: PersistedAnswer[];
};

function toPersistedSession(s: Session): PersistedSession {
  return { ...s, createdAt: s.createdAt ? s.createdAt.toISOString() : null };
}

function fromPersistedSession(s: PersistedSession): Session {
  return {
    ...s,
    resumePath: (s as Record<string, unknown>).resumePath ?? null,
    createdAt: s.createdAt ? new Date(s.createdAt) : null,
  } as Session;
}

function toPersistedAnswer(a: Answer): PersistedAnswer {
  return { ...a, createdAt: a.createdAt ? a.createdAt.toISOString() : null };
}

function fromPersistedAnswer(a: PersistedAnswer): Answer {
  return { ...a, createdAt: a.createdAt ? new Date(a.createdAt) : null } as Answer;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "data", "db.json");

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    const initial: PersistedDb = {
      nextSessionId: 1,
      nextAnswerId: 1,
      sessions: [],
      answers: [],
    };
    await fs.writeFile(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

async function readDb(): Promise<PersistedDb> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const parsed = JSON.parse(raw) as PersistedDb;
  return {
    nextSessionId: parsed.nextSessionId ?? 1,
    nextAnswerId: parsed.nextAnswerId ?? 1,
    sessions: parsed.sessions ?? [],
    answers: parsed.answers ?? [],
  };
}

async function writeDb(db: PersistedDb): Promise<void> {
  await ensureDbFile();
  const tmpPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), "utf-8");
  await fs.rename(tmpPath, DB_PATH);
}

export class JsonFileStorage implements IStorage {
  private queue: Promise<void> = Promise.resolve();

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const prev = this.queue;
    this.queue = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const now = new Date();

      const session: Session = {
        id: db.nextSessionId++,
        role: insertSession.role,
        status: "in_progress",
        firstName: null,
        lastName: null,
        phone: null,
        resumePath: null,
        skills: insertSession.skills ?? null,
        createdAt: now,
      };

      db.sessions.push(toPersistedSession(session));
      await writeDb(db);
      return session;
    });
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const found = db.sessions.find((s) => s.id === id);
      return found ? fromPersistedSession(found) : undefined;
    });
  }

  async updateSessionStatus(id: number, status: string): Promise<Session> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const idx = db.sessions.findIndex((s) => s.id === id);
      if (idx === -1) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      }
      const updated: Session = fromPersistedSession({ ...db.sessions[idx], status });
      db.sessions[idx] = toPersistedSession(updated);
      await writeDb(db);
      return updated;
    });
  }

  async updateCandidate(
    id: number,
    data: { firstName: string; lastName: string; phone: string },
  ): Promise<Session> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const idx = db.sessions.findIndex((s) => s.id === id);
      if (idx === -1) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      }
      const updated: Session = fromPersistedSession({
        ...db.sessions[idx],
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });
      db.sessions[idx] = toPersistedSession(updated);
      await writeDb(db);
      return updated;
    });
  }

  async setSessionResume(id: number, resumePath: string): Promise<Session> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const idx = db.sessions.findIndex((s) => s.id === id);
      if (idx === -1) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      }
      const updated: Session = fromPersistedSession({
        ...db.sessions[idx],
        resumePath,
      });
      db.sessions[idx] = toPersistedSession(updated);
      await writeDb(db);
      return updated;
    });
  }

  async deleteSession(id: number): Promise<void> {
    return this.runExclusive(async () => {
      const db = await readDb();
      db.sessions = db.sessions.filter((s) => s.id !== id);
      db.answers = db.answers.filter((a) => a.sessionId !== id);
      await writeDb(db);
    });
  }

  async submitAnswer(insertAnswer: InsertAnswer): Promise<Answer> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const now = new Date();

      const answer: Answer = {
        id: db.nextAnswerId++,
        sessionId: insertAnswer.sessionId,
        questionId: insertAnswer.questionId,
        questionText: insertAnswer.questionText,
        answerText: insertAnswer.answerText,
        isCorrect: insertAnswer.isCorrect,
        timeSpentSec: insertAnswer.timeSpentSec ?? null,
        createdAt: now,
      };

      db.answers.push(toPersistedAnswer(answer));
      await writeDb(db);
      return answer;
    });
  }

  async getDashboardSessions(): Promise<DashboardSession[]> {
    return this.runExclusive(async () => {
      const db = await readDb();
      const sessionsHydrated = db.sessions.map(fromPersistedSession);
      const answersHydrated = db.answers.map(fromPersistedAnswer);

      sessionsHydrated.sort((a, b) => {
        const at = a.createdAt ? a.createdAt.getTime() : 0;
        const bt = b.createdAt ? b.createdAt.getTime() : 0;
        return bt - at;
      });

      return sessionsHydrated.map((session) => ({
        ...session,
        answers: answersHydrated.filter((a) => a.sessionId === session.id),
      }));
    });
  }
}

export const storage = new JsonFileStorage();
