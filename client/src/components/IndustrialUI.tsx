import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  isLoading?: boolean;
}

export const IndustrialButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyles = "relative inline-flex items-center justify-center px-6 py-3 font-mono font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group";
    
    const variants = {
      primary: "bg-primary/10 text-primary border border-primary hover:bg-primary hover:text-primary-foreground hover:box-glow-primary",
      outline: "bg-transparent text-foreground border border-border hover:border-primary hover:text-primary hover:bg-primary/5",
      ghost: "bg-transparent text-muted-foreground hover:text-foreground",
      destructive: "bg-destructive/10 text-destructive border border-destructive hover:bg-destructive hover:text-destructive-foreground hover:box-glow-destructive"
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white rounded-full group-hover:w-32 group-hover:h-32 opacity-10"></span>
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        <span className="relative flex items-center z-10">{children}</span>
      </button>
    );
  }
);
IndustrialButton.displayName = 'IndustrialButton';

export const IndustrialCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("industrial-border p-6", className)} {...props}>
    {children}
  </div>
);

export const BlinkingCursor = () => (
  <span
    className="ml-1 inline-block min-w-[0.55em] translate-y-[0.08em] align-baseline font-bold leading-none text-primary animate-blink-cursor select-none"
    aria-hidden
  >
    _
  </span>
);
