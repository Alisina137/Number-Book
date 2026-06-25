import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetBook, getGetBookQueryKey, useGenerateResources } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Library, ArrowRight, Loader2, RefreshCw, AlertCircle,
  Lightbulb, Users, Grid3x3, BarChart2, BookMarked, Quote, Columns3,
  Lock, Unlock,
} from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";

interface ExpertInsight {
  name: string;
  concepts: string[];
}
interface ContentPillar {
  number: number;
  title: string;
  description: string;
}
interface ResourceData {
  keyConcepts: string[];
  expertInsights: ExpertInsight[];
  frameworks: string[];
  statisticsAreas: string[];
  storyOpportunities: string[];
  quoteThemes: string[];
  contentPillars: ContentPillar[];
  lockedSections: string[];
}

const SECTION_KEYS = [
  "keyConcepts",
  "expertInsights",
  "frameworks",
  "statisticsAreas",
  "storyOpportunities",
  "quoteThemes",
  "contentPillars",
] as const;

type SectionKey = typeof SECTION_KEYS[number];

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full text-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function ResourceCard({
  sectionKey,
  icon: Icon,
  title,
  color,
  isLocked,
  onToggleLock,
  onRegenerate,
  isRegenerating,
  children,
}: {
  sectionKey: SectionKey;
  icon: React.ElementType;
  title: string;
  color: string;
  isLocked: boolean;
  onToggleLock: (key: SectionKey) => void;
  onRegenerate: (key: SectionKey) => void;
  isRegenerating: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl p-5 transition-colors ${isLocked ? "border-primary/40 bg-primary/5" : "border-card-border"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          {isLocked && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Locked</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isLocked && (
            <button
              onClick={() => onRegenerate(sectionKey)}
              disabled={isRegenerating}
              title="Regenerate this section"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            onClick={() => onToggleLock(sectionKey)}
            title={isLocked ? "Unlock section" : "Lock section"}
            className={`p-1.5 rounded-lg transition-colors ${
              isLocked
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function Resources() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const hasAutoTriggered = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedSections, setLockedSections] = useState<Set<SectionKey>>(new Set());
  const [regeneratingSection, setRegeneratingSection] = useState<SectionKey | null>(null);

  const { data: book, isLoading: bookLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const generateResourcesMutation = useGenerateResources();

  const runGenerate = (locked: string[] = []) => {
    setErrorMessage(null);
    generateResourcesMutation.mutate(
      { id: bookId, data: { lockedSections: locked } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          setRegeneratingSection(null);
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as { message?: string })?.message ??
            "Resource generation failed. Please try again.";
          setErrorMessage(msg);
          setRegeneratingSection(null);
        },
      }
    );
  };

  useEffect(() => {
    if (book && book.status === "analysis" && !hasAutoTriggered.current && !generateResourcesMutation.isPending) {
      hasAutoTriggered.current = true;
      runGenerate([]);
    }
  }, [book?.status]);

  // Sync locked sections from stored data on load
  useEffect(() => {
    if (book?.resourceData) {
      try {
        const data = JSON.parse(book.resourceData) as ResourceData;
        if (data.lockedSections?.length) {
          setLockedSections(new Set(data.lockedSections as SectionKey[]));
        }
      } catch {
        // ignore
      }
    }
  }, [book?.resourceData]);

  const isGenerating = generateResourcesMutation.isPending && regeneratingSection === null;

  const handleToggleLock = (key: SectionKey) => {
    setLockedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRegenerate = (key: SectionKey) => {
    setRegeneratingSection(key);
    const locked = [...lockedSections].filter((k) => k !== key);
    runGenerate(locked);
  };

  let resources: ResourceData | null = null;
  try {
    if (book?.resourceData) resources = JSON.parse(book.resourceData) as ResourceData;
  } catch {
    // ignore
  }

  const hasResources = !!resources;

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SECTIONS: {
    key: SectionKey;
    icon: React.ElementType;
    title: string;
    color: string;
    render: (r: ResourceData) => React.ReactNode;
  }[] = [
    {
      key: "keyConcepts",
      icon: Lightbulb,
      title: "Key Concepts",
      color: "bg-yellow-100 text-yellow-600",
      render: (r) => <TagList items={r.keyConcepts} />,
    },
    {
      key: "expertInsights",
      icon: Users,
      title: "Expert Insights",
      color: "bg-blue-100 text-blue-600",
      render: (r) => (
        <div className="space-y-2 mt-2">
          {r.expertInsights.map((e, i) => (
            <div key={i} className="text-xs">
              <span className="font-medium text-foreground">{e.name}</span>
              <span className="text-muted-foreground"> — {e.concepts.join(", ")}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "frameworks",
      icon: Grid3x3,
      title: "Frameworks & Models",
      color: "bg-purple-100 text-purple-600",
      render: (r) => <TagList items={r.frameworks} />,
    },
    {
      key: "statisticsAreas",
      icon: BarChart2,
      title: "Statistics & Research Areas",
      color: "bg-teal-100 text-teal-600",
      render: (r) => <TagList items={r.statisticsAreas} />,
    },
    {
      key: "storyOpportunities",
      icon: BookMarked,
      title: "Story Opportunities",
      color: "bg-green-100 text-green-600",
      render: (r) => <TagList items={r.storyOpportunities} />,
    },
    {
      key: "quoteThemes",
      icon: Quote,
      title: "Quote & Wisdom Themes",
      color: "bg-pink-100 text-pink-600",
      render: (r) => <TagList items={r.quoteThemes} />,
    },
    {
      key: "contentPillars",
      icon: Columns3,
      title: "Content Pillars",
      color: "bg-orange-100 text-orange-600",
      render: (r) => (
        <div className="space-y-2 mt-2">
          {r.contentPillars.map((p) => (
            <div key={p.number} className="text-xs">
              <span className="font-semibold text-foreground">Pillar {p.number}: {p.title}</span>
              <p className="text-muted-foreground mt-0.5">{p.description}</p>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full">
      <aside className="w-52 flex-shrink-0 border-r border-border bg-muted/30 p-5 flex flex-col gap-6">
        {book?.title && (
          <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{book.title}</p>
        )}
        <BookStepNav bookId={bookId} current="resources" bookStatus={book?.status} />
      </aside>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <Library className="w-4 h-4" />
                Step 2 of 6 — Resources
              </div>
              <h1 className="text-2xl font-semibold">{book?.deepNiche} Resources</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Research library that powers Blueprint and Write quality — lock sections to preserve them across regenerations
              </p>
            </div>

            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-accent/50 border border-accent-border rounded-xl p-10 flex flex-col items-center text-center mb-6"
                >
                  <Library className="w-8 h-8 text-primary mb-4 animate-pulse" />
                  <p className="font-medium text-foreground">Building Research Library</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gathering concepts, experts, frameworks, pillars, and story opportunities…
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isGenerating && errorMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 mb-6"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-destructive text-sm">Generation failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                    </div>
                  </div>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => runGenerate([...lockedSections])}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!isGenerating && !errorMessage && hasResources && resources && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SECTIONS.map((section) => {
                    const isLocked = lockedSections.has(section.key);
                    const isThisRegenerating = generateResourcesMutation.isPending && regeneratingSection === section.key;
                    return (
                      <ResourceCard
                        key={section.key}
                        sectionKey={section.key}
                        icon={section.icon}
                        title={section.title}
                        color={section.color}
                        isLocked={isLocked}
                        onToggleLock={handleToggleLock}
                        onRegenerate={handleRegenerate}
                        isRegenerating={isThisRegenerating}
                      >
                        {isThisRegenerating ? (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" /> Regenerating…
                          </div>
                        ) : (
                          section.render(resources!)
                        )}
                      </ResourceCard>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => runGenerate([...lockedSections])}
                    disabled={generateResourcesMutation.isPending}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Regenerate All
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => setLocation(`/books/${bookId}/structure`)}
                    disabled={generateResourcesMutation.isPending}
                  >
                    Continue to Structure
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
