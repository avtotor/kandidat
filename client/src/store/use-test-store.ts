import { create } from 'zustand';
import type { Question } from '@shared/schema';

interface TestStore {
  sessionId: number | null;
  questions: Question[];
  startSession: (id: number, questions: Question[]) => void;
  clearSession: () => void;
}

export const useTestStore = create<TestStore>((set) => ({
  sessionId: null,
  questions: [],
  startSession: (id, questions) => set({ sessionId: id, questions }),
  clearSession: () => set({ sessionId: null, questions: [] }),
}));
