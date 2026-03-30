import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTestStore } from "@/store/use-test-store";
import { useSubmitAnswer, useUpdateSessionStatus } from "@/hooks/use-assessment";
import { IndustrialButton, IndustrialCard, BlinkingCursor } from "@/components/IndustrialUI";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, XSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TestPage() {
  const [, setLocation] = useLocation();
  const { sessionId, questions, clearSession } = useTestStore();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<{ isCorrect: boolean; correctIndex: number } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());

  const isTransitioning = revealedAnswer !== null;

  const submitAnswer = useSubmitAnswer();
  const updateStatus = useUpdateSessionStatus();

  // Redirect if no active session
  useEffect(() => {
    if (!sessionId || questions.length === 0) {
      setLocation("/");
    }
  }, [sessionId, questions, setLocation]);

  // Сброс таймера и времени старта при смене вопроса
  useEffect(() => {
    setCountdown(120);
    setQuestionStartedAt(Date.now());
  }, [currentSlide]);

  // Обратный отсчёт 1 раз в секунду (не тикаем во время показа правильного ответа)
  useEffect(() => {
    if (isFinished || isTransitioning || countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [isFinished, isTransitioning, countdown]);

  if (!sessionId || questions.length === 0) return null;

  const currentQuestion = questions[currentSlide];

  const handleSelectOption = (idx: number) => {
    if (isTransitioning || isFinished) return;
    
    setSelectedOption(idx);
    
    const timeSpentSec = Math.round((Date.now() - questionStartedAt) / 1000);
    submitAnswer.mutate({
      sessionId,
      questionId: currentQuestion.id,
      selectedIndex: idx,
      timeSpentSec,
    }, {
      onSuccess: (data) => {
        if (data.isCorrect) setCorrectCount((c) => c + 1);
        setRevealedAnswer({ isCorrect: data.isCorrect, correctIndex: data.correctIndex });
        
        // Wait 1.5s then advance
        setTimeout(() => {
          if (currentSlide < questions.length - 1) {
            setCurrentSlide(prev => prev + 1);
            setSelectedOption(null);
            setRevealedAnswer(null);
          } else {
            // Test complete
            updateStatus.mutate({ sessionId, status: 'completed' }, {
              onSuccess: () => {
                setIsFinished(true);
              }
            });
          }
        }, 1500);
      }
    });
  };

  const handleReturnToBase = () => {
    clearSession();
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-4xl mx-auto">
      
      {/* Top Bar */}
      <div className="flex justify-between items-end border-b border-border pb-4 mb-8">
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">СЕССИЯ: 0x{sessionId.toString(16).toUpperCase().padStart(4, '0')}</div>
          <h2 className="text-xl font-bold text-foreground tracking-widest">ТЕСТ В ПРОЦЕССЕ<BlinkingCursor /></h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">ПРОГРЕСС</div>
          <div className="font-bold text-primary font-mono text-lg">
            {Math.min(currentSlide + 1, questions.length)} / {questions.length}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <IndustrialCard className="mb-6 bg-muted/20 border-l-4 border-l-primary p-0 overflow-hidden">
                <div className="bg-primary text-black px-6 py-4">
                  <span className="text-xs text-black/70 block mb-2 tracking-widest uppercase">ВОПРОС_{currentSlide + 1}:</span>
                  <p className="text-lg md:text-xl font-medium leading-relaxed">
                    {currentQuestion.text}
                  </p>
                </div>
                {(currentQuestion.code || currentQuestion.image) && (
                  <div className="bg-muted/30 border-t border-border p-6">
                    {currentQuestion.code && (
                      <div className="mb-4 last:mb-0 bg-black/60 border border-border/50 p-4 rounded-sm font-mono text-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-1 text-[8px] text-muted-foreground uppercase bg-border/20 border-bl border-border/50">КОД</div>
                        <pre className="text-primary/90 leading-relaxed overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20">
                          <code>{currentQuestion.code}</code>
                        </pre>
                      </div>
                    )}
                    {currentQuestion.image && (
                      <div className="border border-border/50 rounded-sm overflow-hidden bg-black/20 flex items-center justify-center p-2 w-[500px] h-[500px] mx-auto">
                        <img 
                          src={currentQuestion.image} 
                          alt="" 
                          className="max-h-full max-w-full object-contain brightness-90 contrast-125 grayscale hover:grayscale-0 transition-all duration-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </IndustrialCard>

              <div className="space-y-4">
                {currentQuestion.options.map((opt, idx) => {
                  
                  // Determine styling based on state
                  let itemState: 'default' | 'selected' | 'correct' | 'incorrect' = 'default';
                  
                  if (revealedAnswer) {
                    if (idx === revealedAnswer.correctIndex) {
                      itemState = 'correct';
                    } else if (idx === selectedOption) {
                      itemState = 'incorrect';
                    }
                  } else if (selectedOption === idx) {
                    itemState = 'selected';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={isTransitioning}
                      className={cn(
                        "group flex w-full items-center gap-4 border p-4 text-left transition-all duration-300",
                        itemState === 'default' &&
                          "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5",
                        itemState === 'selected' && "border-primary bg-primary/10 text-foreground",
                        itemState === 'correct' &&
                          "border-primary bg-primary/20 text-foreground shadow-[0_0_15px_-3px_rgba(57,255,20,0.3)]",
                        itemState === 'incorrect' && "border-destructive bg-destructive/20 text-destructive shadow-[0_0_15px_-3px_rgba(255,69,0,0.3)]"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex w-11 shrink-0 justify-end font-mono text-sm tabular-nums leading-relaxed",
                          itemState === 'incorrect' ? "text-destructive" : "text-primary"
                        )}
                      >
                        [{idx}]
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 font-mono text-sm leading-relaxed",
                          itemState === 'incorrect' ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {opt}
                      </span>

                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        {itemState === 'correct' && <CheckSquare className="h-5 w-5 text-primary" />}
                        {itemState === 'incorrect' && <XSquare className="h-5 w-5 text-destructive" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 font-mono text-xs text-foreground/30">
                <span className="tabular-nums min-w-[2rem] text-center">{countdown}</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <IndustrialCard className="max-w-md w-full text-center border-primary/50 shadow-[0_0_30px_-5px_rgba(57,255,20,0.15)]">
                <Trophy className="mx-auto w-14 h-14 text-primary mb-6" />
                
                <h2 className="text-2xl md:text-3xl font-bold text-glow-primary text-foreground mb-6">
                  ТЕСТ ЗАВЕРШЁН
                </h2>
                
                <div className="font-mono text-lg text-foreground mb-8">
                  <span className="text-primary font-bold">{correctCount}</span>
                  <span className="text-muted-foreground"> из </span>
                  <span className="font-bold">{questions.length}</span>
                  <span className="text-muted-foreground"> правильных</span>
                  <span className="block mt-2 text-2xl font-bold text-primary">
                    {questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%
                  </span>
                </div>

                <IndustrialButton onClick={handleReturnToBase} className="w-full">
                  [ НА ГЛАВНУЮ ]
                </IndustrialButton>
              </IndustrialCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
