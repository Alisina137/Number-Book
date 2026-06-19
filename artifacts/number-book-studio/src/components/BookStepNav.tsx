import { useLocation } from "wouter";
import { BookOpen, PenLine, ShieldCheck, Download, ChevronLeft } from "lucide-react";

const STEPS = [
  { key: "blueprint", label: "Blueprint", icon: BookOpen, path: "blueprint" },
  { key: "write", label: "Write", icon: PenLine, path: "write" },
  { key: "quality", label: "Quality", icon: ShieldCheck, path: "quality" },
  { key: "export", label: "Export", icon: Download, path: "export" },
];

interface BookStepNavProps {
  bookId: number;
  current: "blueprint" | "write" | "quality" | "export";
}

export function BookStepNav({ bookId, current }: BookStepNavProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Steps
      </h2>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.key === current;
        return (
          <button
            key={step.key}
            onClick={() => setLocation(`/books/${bookId}/${step.path}`)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background text-muted-foreground"
            }`}>
              {i + 1}
            </span>
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {step.label}
          </button>
        );
      })}

      <div className="pt-3 mt-1 border-t border-border">
        <button
          onClick={() => setLocation("/")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All Books
        </button>
      </div>
    </div>
  );
}
