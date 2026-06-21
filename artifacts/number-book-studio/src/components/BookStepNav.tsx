import { useLocation } from "wouter";
import { FlaskConical, Library, BookOpen, PenLine, ShieldCheck, Download, ChevronLeft } from "lucide-react";

const STEPS = [
  { key: "analysis", label: "Analysis", icon: FlaskConical, path: "analysis" },
  { key: "resources", label: "Resources", icon: Library, path: "resources" },
  { key: "blueprint", label: "Blueprint", icon: BookOpen, path: "blueprint" },
  { key: "write", label: "Write", icon: PenLine, path: "write" },
  { key: "quality", label: "Quality", icon: ShieldCheck, path: "quality" },
  { key: "export", label: "Export", icon: Download, path: "export" },
];

const STATUS_ORDER = ["setup", "analysis", "resources", "blueprint", "writing", "quality", "finished"];
const STEP_STATUSES: Record<string, string> = {
  analysis: "setup",
  resources: "analysis",
  blueprint: "resources",
  write: "blueprint",
  quality: "writing",
  export: "quality",
};

interface BookStepNavProps {
  bookId: number;
  current: "analysis" | "resources" | "blueprint" | "write" | "quality" | "export";
  bookStatus?: string;
}

export function BookStepNav({ bookId, current, bookStatus }: BookStepNavProps) {
  const [, setLocation] = useLocation();

  const currentStatusIndex = STATUS_ORDER.indexOf(bookStatus ?? "setup");

  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Steps
      </h2>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.key === current;
        const requiredStatus = STEP_STATUSES[step.key] ?? "setup";
        const requiredIndex = STATUS_ORDER.indexOf(requiredStatus);
        const isUnlocked = currentStatusIndex >= requiredIndex;

        return (
          <button
            key={step.key}
            onClick={() => isUnlocked && setLocation(`/books/${bookId}/${step.path}`)}
            disabled={!isUnlocked}
            title={!isUnlocked ? "Complete the previous step first" : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : isUnlocked
                ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                : "text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : isUnlocked
                ? "border-border bg-background text-muted-foreground"
                : "border-border/40 bg-background text-muted-foreground/40"
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
