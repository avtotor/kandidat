import { useState, useRef, useEffect } from "react";
import { useDashboard, useUpdateCandidate, useDeleteSession, useUploadResume } from "@/hooks/use-assessment";
import { Link } from "wouter";
import { IndustrialCard, BlinkingCursor } from "@/components/IndustrialUI";
import { Activity, Database, ArrowLeft, X, FileUp, Sparkles, Download, Save, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardSession, Answer } from "@shared/schema";

const SKILLS_META: Array<{ key: keyof NonNullable<DashboardSession["skills"]>; label: string }> = [
  { key: "postgres", label: "POSTGRES / SQL" },
  { key: "cpp", label: "C / C++" },
  { key: "api", label: "API / gRPC / REST" },
  { key: "linux", label: "Linux / Unix OS" },
  { key: "llm", label: "LLM" },
  { key: "git", label: "Git / CMake" },
];

const LEVEL_LABEL: Record<number, string> = {
  0: "нет",
  2: "базовый",
  4: "джуниор+",
  6: "мидл",
  8: "сильный",
  10: "эксперт",
};

function formatSkillLevel(v: number) {
  return `${v}/10${LEVEL_LABEL[v] ? ` (${LEVEL_LABEL[v]})` : ""}`;
}

/** Формат телефона: 8 (123) 123-22-22 */
function formatPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return raw.trim();
  const ten = digits.length >= 11 && digits[0] === "7" ? digits.slice(1) : digits.slice(-10);
  return `8 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 8)}-${ten.slice(8, 10)}`;
}

const LLM_MODEL = "gemma3:4b";

/** Разбивает текст ответа на части и выделяет блок "Оценка: XX%" в стиле industrial */
function renderEvaluationResponse(text: string) {
  const re = /(\*\*?Оценка:\s*\d+%\*?\*?|Оценка:\s*\d+%)/i;
  const match = text.match(re);
  if (!match) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  const scoreRaw = match[1].replace(/\*/g, "").trim();
  const percentMatch = scoreRaw.match(/(\d+%)/);
  const percent = percentMatch ? percentMatch[1] : "";
  const before = text.slice(0, match.index);
  const after = text.slice((match.index ?? 0) + match[0].length);

  return (
    <span className="whitespace-pre-wrap">
      {before && <span>{before}</span>}
      <span className="my-2 flex w-full justify-center font-mono text-sm font-bold uppercase tracking-wide text-primary border border-primary bg-primary/5 px-4 py-2 border-[1px]">
        Оценка — {percent}
      </span>
      {after && <span>{after}</span>}
    </span>
  );
}

export default function Dashboard() {
  const { data: sessions, isLoading, isError } = useDashboard();
  const updateCandidate = useUpdateCandidate();
  const deleteSession = useDeleteSession();
  const uploadResume = useUploadResume();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSessionId, setUploadSessionId] = useState<number | null>(null);
  const [evaluationModal, setEvaluationModal] = useState<{
    open: boolean;
    text: string;
    loading?: boolean;
    startTime?: number;
  }>({ open: false, text: "" });
  const [timerTick, setTimerTick] = useState(0);
  const [uploadSuccessOpen, setUploadSuccessOpen] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<number>>(new Set());
  const [roleFilter, setRoleFilter] = useState<"all" | "cpp" | "stm32" | "data" | "ai">("all");
  const [sortByPercent, setSortByPercent] = useState<"none" | "desc">("none");

  const preparedSessions: DashboardSession[] = (() => {
    if (!sessions) return [];
    const allSessions = sessions as DashboardSession[];
    const filtered = allSessions.filter((s) =>
      roleFilter === "all" ? true : s.role === roleFilter
    );
    if (sortByPercent === "none") return filtered;
    return [...filtered].sort((a, b) => {
      const ta = a.answers.length;
      const tb = b.answers.length;
      const ca = a.answers.filter((x) => x.isCorrect).length;
      const cb = b.answers.filter((x) => x.isCorrect).length;
      const pa = ta > 0 ? Math.round((ca / ta) * 100) : -1;
      const pb = tb > 0 ? Math.round((cb / tb) * 100) : -1;
      return pb - pa;
    });
  })();

  const toggleCardExpanded = (sessionId: number) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  useEffect(() => {
    if (!evaluationModal.open || !evaluationModal.loading || evaluationModal.startTime == null) return;
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [evaluationModal.open, evaluationModal.loading, evaluationModal.startTime]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);

  useEffect(() => {
    if (!saveSuccessVisible) return;
    const t = setTimeout(() => setSaveSuccessVisible(false), 3000);
    return () => clearTimeout(t);
  }, [saveSuccessVisible]);

  const handleUploadResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sessionId = uploadSessionId;
    e.target.value = "";
    setUploadSessionId(null);
    if (!file || sessionId == null) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? (reader.result as string);
      uploadResume.mutate(
        { sessionId, file: base64, fileName: file.name },
        {
          onSuccess: () => setUploadSuccessOpen(true),
          onError: (err) => setUploadError(err instanceof Error ? err.message : "Ошибка загрузки"),
        }
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRequestEvaluation = async (sessionId: number) => {
    setTimerTick(0);
    setEvaluationModal({ open: true, text: "", loading: true, startTime: Date.now() });
    const ac = new AbortController();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        ac.abort();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    try {
      const res = await fetch("/api/ollama/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: LLM_MODEL,
          prompt: "",
          stream: true,
          sessionId,
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Ошибка запроса к LLM");
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuffer = "";
      if (reader) {
        setEvaluationModal((m) => ({ ...m, loading: false, startTime: undefined }));
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line) as { response?: string };
              if (typeof obj.response === "string") {
                accumulated += obj.response;
                setEvaluationModal((m) => ({ ...m, text: accumulated }));
              }
            } catch {
              // неполная строка или не JSON
            }
          }
        }
        if (lineBuffer.trim()) {
          try {
            const obj = JSON.parse(lineBuffer) as { response?: string };
            if (typeof obj.response === "string") accumulated += obj.response;
          } catch {
            // ignore
          }
          setEvaluationModal((m) => ({ ...m, text: accumulated }));
        }
      } else {
        const data = await res.json();
        const responseText = data.response ?? "Нет ответа.";
        setEvaluationModal({ open: true, text: responseText, loading: false });
      }
    } catch (err) {
      const isAborted = err instanceof Error && err.name === "AbortError";
      setEvaluationModal({
        open: true,
        text: isAborted
          ? "Запрос отменён: окно свернуто или вкладка неактивна. LLM прекратила отработку."
          : err instanceof Error
            ? err.message
            : "Не удалось получить ответ от обучаемой модели.",
        loading: false,
      });
    } finally {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* TOPBAR: данные сохранены */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white py-2 text-center text-sm font-mono uppercase tracking-widest transition-opacity duration-300 border-b border-green-500",
          saveSuccessVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        role="status"
        aria-live="polite"
      >
        Данные сохранены
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 pb-4 border-b border-border">
          <div>
            <Link href="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary mb-4 transition-colors">
              <ArrowLeft className="w-3 h-3 mr-1" />
              ВЕРНУТЬСЯ НА ГЛАВНУЮ
            </Link>
            <h1 className="text-3xl font-black tracking-widest text-foreground flex items-center gap-3">
              <Database className="w-6 h-6 text-primary" />
              <span>ПАНЕЛЬ</span>
              {sessions != null && sessions.length > 0 && (
                <span className="text-lg font-mono text-muted-foreground font-normal">
                  {sessions.length} {sessions.length === 1 ? "кандидат" : sessions.length < 5 ? "кандидата" : "кандидатов"}
                </span>
              )}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 text-sm border border-primary/30 px-3 py-1 bg-primary/5">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-primary uppercase tracking-widest font-bold">Канал связи</span>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-muted-foreground font-mono">
            ЗАГРУЗКА ДАННЫХ<BlinkingCursor />
          </div>
        ) : isError ? (
          <div className="p-4 border border-destructive bg-destructive/10 text-destructive font-mono">
            ОШИБКА: не удалось подключиться к хранилищу.
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Фильтры */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>ФИЛЬТР ВАКАНСИИ:</span>
                <select
                  className="border border-border bg-background px-2 py-1 text-[11px] uppercase"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                >
                  <option value="all">ВСЕ</option>
                  <option value="cpp">ПРОГРАММИСТ</option>
                  <option value="stm32">ИНЖЕНЕР</option>
                  <option value="data">ИНЖЕНЕР ДАННЫХ</option>
                  <option value="ai">ИНЖЕНЕР ИИ</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>СОРТИРОВКА:</span>
                <select
                  className="border border-border bg-background px-2 py-1 text-[11px] uppercase"
                  value={sortByPercent}
                  onChange={(e) => setSortByPercent(e.target.value as typeof sortByPercent)}
                >
                  <option value="none">БЕЗ СОРТ.</option>
                  <option value="desc">% ПРАВИЛЬНЫХ ↓</option>
                </select>
              </div>
            </div>

            {preparedSessions.length === 0 && (
              <div className="text-center p-12 border border-dashed border-border text-muted-foreground font-mono">
                СЕССИЙ НЕТ
              </div>
            )}

            {preparedSessions.length > 0 && preparedSessions.map((session, idx) => {
                const totalAnswers = session.answers.length;
                const correctAnswers = session.answers.filter((a) => a.isCorrect).length;
                const percentCorrect = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : null;
                const totalTimeSec = session.answers.reduce((s, a) => s + (a.timeSpentSec ?? 0), 0);
                const totalTimeMin = Math.floor(totalTimeSec / 60);

                const isExpanded = expandedCardIds.has(session.id);
                const displayName = [session.lastName ?? "", session.firstName ?? ""].filter(Boolean).join(" ") || "—";
                const roleLabel = session.role === "cpp" ? "ПРОГРАММИСТ" : session.role === "stm32" ? "ИНЖЕНЕР" : session.role === "data" ? "ИНЖЕНЕР ДАННЫХ" : "ИНЖЕНЕР ИИ";

                const orderNumber = idx + 1;

                return (
                <IndustrialCard key={session.id} className="p-0 overflow-hidden">
                  {!isExpanded ? (
                    <button
                      type="button"
                      className="w-full grid grid-cols-[minmax(2rem,auto)_minmax(7rem,auto)_minmax(9rem,1fr)_minmax(11rem,1fr)_minmax(0,1fr)] gap-x-3 items-center px-4 py-2 text-left hover:bg-muted/20 transition-colors border-b border-border last:border-b-0 font-mono text-xs uppercase"
                      onClick={() => toggleCardExpanded(session.id)}
                    >
                      <span className="text-muted-foreground text-center">{orderNumber}</span>
                      <span className="text-primary tracking-widest truncate">
                        {roleLabel}
                      </span>
                      <span className="text-foreground truncate">
                        {displayName}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {(session.phone ?? "").trim() ? formatPhone(session.phone) : "—"}
                      </span>
                      <span className="flex items-center justify-end gap-4 text-right">
                        {percentCorrect !== null && (
                          <span className="text-primary">
                            {percentCorrect}%{" "}
                            <span className="text-muted-foreground font-normal">
                              ({correctAnswers} правильных, {totalAnswers - correctAnswers} неправильных)
                            </span>
                          </span>
                        )}
                        {totalAnswers > 0 && (
                          <span className="text-foreground/30 ml-1">{totalTimeMin} МИН</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </span>
                    </button>
                  ) : (
                  <div className="flex flex-col lg:flex-row">
                    {/* Session Info Sidebar */}
                    <div className="p-4 lg:p-6 bg-muted/10 border-b lg:border-b-0 lg:border-r border-border lg:w-80 shrink-0 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 font-bold tracking-widest">
                          ID: 0x{session.id.toString(16).toUpperCase().padStart(4, '0')}
                        </div>
                        <div className="text-xl font-bold uppercase tracking-wide text-foreground mb-1 flex items-baseline justify-between gap-2 flex-wrap">
                          <span>
                            {session.role === 'cpp' && 'ПРОГРАММИСТ'}
                            {session.role === 'stm32' && 'ИНЖЕНЕР'}
                            {session.role === 'data' && 'ИНЖЕНЕР ДАННЫХ'}
                            {session.role === 'ai' && 'ИНЖЕНЕР ИИ'}
                          </span>
                          <span className="text-sm font-mono text-primary flex items-baseline gap-2 flex-wrap">
                            {percentCorrect !== null && (
                              <span>{percentCorrect}%</span>
                            )}
                            {totalAnswers > 0 && (
                              <span className="text-foreground/30 font-normal text-sm">
                                {totalTimeMin} мин
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <form
                            id={`form-candidate-${session.id}`}
                            className="space-y-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const firstName = (form.querySelector<HTMLInputElement>('[name="firstName"]')?.value ?? "").trim();
                              const lastName = (form.querySelector<HTMLInputElement>('[name="lastName"]')?.value ?? "").trim();
                              const phone = (form.querySelector<HTMLInputElement>('[name="phone"]')?.value ?? "").trim();
                              if (!firstName || !lastName || !phone) return;
                              updateCandidate.mutate(
                                { sessionId: session.id, firstName, lastName, phone },
                                { onSuccess: () => setSaveSuccessVisible(true) }
                              );
                            }}
                          >
                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground">Имя</label>
                                <input
                                  defaultValue={session.firstName ?? ""}
                                  className="px-2 py-1 text-xs bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                                  name="firstName"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground">Фамилия</label>
                                <input
                                  defaultValue={session.lastName ?? ""}
                                  className="px-2 py-1 text-xs bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                                  name="lastName"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground">Телефон</label>
                                <input
                                  defaultValue={session.phone ?? ""}
                                  className="px-2 py-1 text-xs bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                                  name="phone"
                                />
                              </div>
                            </div>
                          </form>
                          <button
                            type="submit"
                            form={`form-candidate-${session.id}`}
                            className="w-full text-[11px] font-mono text-foreground border border-border px-2 py-1 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Сохранить
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            className="hidden"
                            onChange={handleUploadResume}
                          />
                          <button
                            type="button"
                            className="w-full text-[11px] font-mono text-foreground border border-border px-2 py-1 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                            onClick={() => {
                              setUploadSessionId(session.id);
                              fileInputRef.current?.click();
                            }}
                            disabled={uploadResume.isPending}
                          >
                            <FileUp className="w-3 h-3" />
                            {session.resumePath ? "Заменить резюме" : "Загрузить резюме"}
                          </button>
                          {session.resumePath ? (
                            <a
                              href={`/api/sessions/${session.id}/resume`}
                              download={session.resumePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 w-full text-[11px] font-mono text-primary border border-primary/50 px-2 py-1 hover:bg-primary/10 transition-colors"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              Скачать резюме
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="w-full text-[11px] font-mono text-primary border border-primary/60 px-2 py-1 hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
                            onClick={() => handleRequestEvaluation(session.id)}
                          >
                            <Sparkles className="w-3 h-3" />
                            Запросить оценку резюме
                          </button>
                        </div>
                        <div className="mt-4">
                          {session.skills ? (
                            <div className="space-y-1">
                              {SKILLS_META.map(({ key, label }) => (
                                <div key={key} className="flex justify-between gap-3 text-[11px] font-mono">
                                  <span className="text-muted-foreground truncate">{label}</span>
                                  <span className="text-primary font-bold whitespace-nowrap">
                                    {formatSkillLevel(session.skills![key])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">Самооценка не заполнена</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <span className={cn(
                          "inline-flex items-center text-xs font-bold px-2 py-1 uppercase tracking-widest border",
                          session.status === 'completed' 
                            ? "border-primary text-primary bg-primary/10 text-glow-primary" 
                            : "border-muted-foreground text-muted-foreground bg-muted/20"
                        )}>
                          {session.status === 'completed' ? 'ТЕСТ ЗАВЕРШЕН' : 'ТЕСТ В ПРОЦЕССЕ'}
                          {session.status !== 'completed' && <BlinkingCursor />}
                        </span>
                        <button
                          className="mt-3 w-full text-[11px] font-mono text-destructive border border-destructive/60 px-2 py-1 hover:bg-destructive/10 transition-colors"
                          onClick={() => {
                            if (!confirm("Удалить данные кандидата и все ответы?")) return;
                            deleteSession.mutate({ sessionId: session.id });
                          }}
                        >
                          УДАЛИТЬ КАНДИДАТА
                        </button>
                      </div>
                    </div>

                    {/* Answers Timeline */}
                    <div className="p-4 lg:p-6 flex-1 bg-background flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">Ответы :</div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors p-0 bg-transparent border-0"
                          onClick={() => toggleCardExpanded(session.id)}
                          title="Свернуть"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {session.answers.length === 0 && (
                          <div className="text-sm text-muted-foreground italic">Ожидание ответов...</div>
                        )}
                        
                        {session.answers.map((answer: Answer, i: number) => (
                          <div 
                            key={answer.id}
                            className={cn(
                              "flex items-stretch border transition-all",
                              answer.isCorrect 
                                ? "border-primary bg-primary/5" 
                                : "border-destructive bg-destructive/5"
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center w-8 px-2 text-[10px] font-mono shrink-0 border-r",
                                answer.isCorrect
                                  ? "border-primary text-primary bg-primary/20"
                                  : "border-destructive text-destructive bg-destructive/30"
                              )}
                            >
                              {i + 1}
                            </div>
                            <div className="flex-1 p-2">
                              <div className="text-xs font-mono font-semibold text-muted-foreground mb-1">
                                {answer.questionText}
                              </div>
                              <div
                                className={cn(
                                  "text-xs font-mono italic",
                                  answer.isCorrect ? "text-foreground/90" : "text-muted-foreground"
                                )}
                              >
                                {answer.answerText}
                                {answer.timeSpentSec != null && `, ${answer.timeSpentSec} с`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                  )}
                </IndustrialCard>
                );
              })}
          </div>
        )}
      </div>

      <Dialog open={uploadSuccessOpen} onOpenChange={setUploadSuccessOpen}>
        <DialogContent className="max-w-lg rounded-none border-[1px]">
          <DialogHeader>
            <DialogTitle>Резюме загружено</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Резюме успешно сохранено на сервер.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadError} onOpenChange={(open) => !open && setUploadError(null)}>
        <DialogContent className="max-w-lg rounded-none border-[1px]">
          <DialogHeader>
            <DialogTitle>Ошибка загрузки</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive">{uploadError}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={evaluationModal.open} onOpenChange={(open) => setEvaluationModal((m) => ({ ...m, open }))}>
        <DialogContent className="max-w-5xl rounded-none border-[1px]">
          <DialogHeader>
            <DialogTitle>Ответ модели</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {evaluationModal.loading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-1">
                  Запрос к LLM · {LLM_MODEL}
                </div>
                <div className="flex items-baseline gap-1 font-mono tabular-nums">
                  <span className="text-4xl font-bold text-foreground border border-border bg-muted/20 px-3 py-1 min-w-[3.5rem] text-center">
                    {String(Math.floor(Math.round((evaluationModal.startTime ? Date.now() - evaluationModal.startTime : 0) / 1000) / 60)).padStart(2, "0")}
                  </span>
                  <span className="text-4xl font-bold text-primary">:</span>
                  <span className="text-4xl font-bold text-foreground border border-border bg-muted/20 px-3 py-1 min-w-[3.5rem] text-center">
                    {String(Math.round((evaluationModal.startTime ? Date.now() - evaluationModal.startTime : 0) / 1000) % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  мин · сек
                </div>
              </div>
            ) : (
              <div className="text-sm font-mono bg-muted/30 p-3 rounded-none border border-[1px] border-border">
                {renderEvaluationResponse(evaluationModal.text)}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
