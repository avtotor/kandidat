import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = "ABCEFGHJKMNPRSTXYZ018$/\\#+*";
const TARGET = "TEST";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrambleTowards(t: number): string {
  return TARGET.split("")
    .map((c, i) => {
      const lockAt = i / TARGET.length + 0.12;
      if (t >= lockAt) return c;
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? c;
    })
    .join("");
}

export function HackerTestWord({ className }: { className?: string }) {
  const [text, setText] = useState(() => (reducedMotion() ? TARGET : "????"));

  useEffect(() => {
    if (reducedMotion()) {
      setText(TARGET);
      return;
    }

    let cancelled = false;
    const start = performance.now();
    const duration = 1200;

    function frame(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      setText(scrambleTowards(t));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reducedMotion()) return;

    const outer = window.setInterval(() => {
      if (Math.random() > 0.45) return;

      let step = 0;
      const inner = window.setInterval(() => {
        step += 1;
        if (step <= 4) {
          setText(
            TARGET.split("")
              .map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "?")
              .join("")
          );
        } else {
          setText(TARGET);
          window.clearInterval(inner);
        }
      }, 42);
    }, 3200);

    return () => window.clearInterval(outer);
  }, []);

  return (
    <span
      className={cn("hacker-test-word relative inline-block align-baseline", className)}
      data-text={text}
    >
      {text}
    </span>
  );
}
