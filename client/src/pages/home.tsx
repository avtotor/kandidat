import { useLocation, Link } from "wouter";
import { useCreateSession, useQuestionCounts } from "@/hooks/use-assessment";
import { useTestStore } from "@/store/use-test-store";
import { BlinkingCursor, IndustrialButton, IndustrialCard } from "@/components/IndustrialUI";
import { HackerTestWord } from "@/components/HackerTestWord";
import { ChevronLeft, ChevronRight, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Skills = {
  postgres: number;
  cpp: number;
  api: number;
  linux: number;
  llm: number;
  git: number;
};

const SKILLS_LIST: Array<{ id: keyof Skills; label: string }> = [
  { id: "postgres", label: "POSTGRES / SQL" },
  { id: "cpp", label: "C / C++" },
  { id: "api", label: "API / gRPC / REST" },
  { id: "linux", label: "Linux / Unix OS" },
  { id: "llm", label: "LLM" },
  { id: "git", label: "Git / CMake" },
];

const SKILL_LEVEL_MARKS: Array<{ value: number; label: string }> = [
  { value: 0, label: "0 — нет" },
  { value: 2, label: "2 — базовый" },
  { value: 4, label: "4 — джуниор+" },
  { value: 6, label: "6 — мидл" },
  { value: 8, label: "8 — сильный" },
  { value: 10, label: "10 — эксперт" },
];

function levelLabel(v: number) {
  return SKILL_LEVEL_MARKS.find((m) => m.value === v)?.label ?? `${v}/10`;
}

type Role = 'cpp' | 'stm32' | 'data' | 'ai';

const ROLE_SLIDES: Array<{
  role: Role;
  idLabel: string;
  badge: string;
  title: string;
  description: string;
  details: string;
  countKey: Role;
}> = [
  {
    role: "cpp",
    idLabel: "ID: 0x01",
    badge: "Код",
    title: "ПРОГРАММИСТ",
    description: "Проверка фундаментальных знаний программирования:",
    details: "C/C++, память, ООП, STL, практические нюансы.",
    countKey: "cpp",
  },
  {
    role: "stm32",
    idLabel: "ID: 0x02",
    badge: "Железо",
    title: "ИНЖЕНЕР",
    description: "Проверка инженерных навыков:",
    details: "регистры, прерывания, DMA, RTOS и практики embedded.",
    countKey: "stm32",
  },
  {
    role: "data",
    idLabel: "ID: 0x03",
    badge: "Данные",
    title: "ИНЖЕНЕР ДАННЫХ",
    description: "Проектирование хранилищ и пайплайнов:",
    details: "потоковая/пакетная обработка, качество и надёжность данных.",
    countKey: "data",
  },
  {
    role: "ai",
    idLabel: "ID: 0x04",
    badge: "ИИ",
    title: "ИНЖЕНЕР ИИ",
    description: "Модели машинного обучения и LLM:",
    details: "интеграция AI в продукты, качество и мониторинг моделей.",
    countKey: "ai",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();
  const { data: questionCounts } = useQuestionCounts();
  const startSession = useTestStore((state) => state.startSession);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleSlideIndex, setRoleSlideIndex] = useState(0);
  const [skills, setSkills] = useState<Skills>({
    postgres: 5,
    cpp: 5,
    api: 5,
    linux: 5,
    llm: 5,
    git: 5,
  });

  const handleInit = () => {
    if (!selectedRole) return;
    createSession.mutate({ role: selectedRole, skills }, {
      onSuccess: (data) => {
        startSession(data.id, data.questions);
        setLocation("/test");
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[70.4rem] space-y-12"
      >
        
        {/* Header Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-primary/5 border border-primary/30 rounded-full mb-4">
            <Terminal className="h-10 w-10 text-primary" strokeWidth={1.75} aria-hidden />
          </div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-glow-primary text-foreground"
            aria-label="АВТОТОР TEST"
          >
            АВТОТОР
            <HackerTestWord />
          </h1>
          <p className="mx-auto mt-4 flex max-w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-1 font-mono text-sm md:text-base">
            <span className="shrink-0 text-primary/90 tracking-tight">$kandidat@avtotor.ru</span>
            {selectedRole ? (
              <span className="text-muted-foreground">Заполните профиль навыков перед стартом теста</span>
            ) : (
              <span className="inline-flex items-center text-muted-foreground">
                Выберите вакансию для оценки
                <BlinkingCursor />
              </span>
            )}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!selectedRole ? (
            <motion.div
              key="roles"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mx-auto w-full max-w-xl space-y-8"
            >
              <div className="relative">
                <button
                  type="button"
                  aria-label="Предыдущий слайд"
                  onClick={() =>
                    setRoleSlideIndex((i) => (i - 1 + ROLE_SLIDES.length) % ROLE_SLIDES.length)
                  }
                  className="absolute left-0 top-1/2 z-10 -translate-x-1 -translate-y-1/2 rounded-sm border border-primary/40 bg-background/90 p-2 text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/10 md:-translate-x-12"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="Следующий слайд"
                  onClick={() =>
                    setRoleSlideIndex((i) => (i + 1) % ROLE_SLIDES.length)
                  }
                  className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1 rounded-sm border border-primary/40 bg-background/90 p-2 text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary/10 md:translate-x-12"
                >
                  <ChevronRight className="size-6" />
                </button>

                <div className="overflow-hidden rounded-md px-1">
                  <div
                    className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
                    style={{ transform: `translateX(-${roleSlideIndex * 100}%)` }}
                  >
                    {ROLE_SLIDES.map((slide) => (
                      <div key={slide.role} className="w-full shrink-0 px-1">
                        <IndustrialCard
                          className="group relative flex min-h-[280px] flex-col items-start cursor-pointer transition-colors hover:border-primary/50"
                          onClick={() => setSelectedRole(slide.role)}
                        >
                          <div className="mb-6 flex w-full items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground">
                              {slide.idLabel}
                            </span>
                            <span className="border border-primary/30 px-2 py-1 text-[10px] uppercase text-primary">
                              {slide.badge}
                            </span>
                          </div>
                          <h2 className="mb-4 text-2xl font-bold text-foreground">{slide.title}</h2>
                          <p className="mb-8 min-h-[60px] text-sm text-muted-foreground">
                            {slide.description}
                            <br />
                            {slide.details}
                          </p>
                          <div className="mt-auto text-xs font-mono uppercase tracking-widest text-primary group-hover:text-glow-primary">
                            [ ВЫБРАТЬ ]
                          </div>
                          {questionCounts != null && (
                            <span
                              className="pointer-events-none absolute bottom-3 right-4 select-none text-4xl font-bold tabular-nums text-foreground/25"
                              aria-hidden
                            >
                              {questionCounts[slide.countKey]}
                            </span>
                          )}
                        </IndustrialCard>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="flex justify-center gap-2.5"
                role="tablist"
                aria-label="Слайды вакансий"
              >
                {ROLE_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === roleSlideIndex}
                    aria-label={`Слайд ${i + 1} из ${ROLE_SLIDES.length}`}
                    onClick={() => setRoleSlideIndex(i)}
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-[2px] border border-primary/45 transition-all duration-200 hover:border-primary",
                      i === roleSlideIndex
                        ? "scale-110 border-primary bg-primary shadow-[0_0_12px_-2px_hsl(var(--primary))]"
                        : "bg-transparent"
                    )}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="skills"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <IndustrialCard className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-primary">Профиль навыков</h3>
                  <button onClick={() => setSelectedRole(null)} className="text-[10px] text-muted-foreground hover:text-primary uppercase underline">Назад к вакансиям</button>
                </div>
                <div className="grid grid-cols-1 gap-y-6">
                  {SKILLS_LIST.map((skill) => (
                    <div key={skill.id} className="space-y-3">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-muted-foreground">{skill.label}</span>
                        <span className="text-primary font-bold">{levelLabel(skills[skill.id])}</span>
                      </div>
                      <Slider
                        value={[skills[skill.id]]}
                        onValueChange={([v]) => setSkills(s => ({ ...s, [skill.id]: v }))}
                        max={10}
                        step={2}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground select-none">
                        {SKILL_LEVEL_MARKS.map((m) => (
                          <span key={m.value} className={skills[skill.id] === m.value ? "text-primary" : undefined}>
                            {m.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <IndustrialButton 
                  className="w-full mt-8" 
                  onClick={handleInit}
                  isLoading={createSession.isPending}
                >
                  [ НАЧАТЬ ТЕСТ ]
                </IndustrialButton>
              </IndustrialCard>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-primary transition-colors underline decoration-dashed underline-offset-4">
            ОТКРЫТЬ ПАНЕЛЬ РЕКРУТЕРА
          </Link>
        </div>

      </motion.div>
    </div>
  );
}
