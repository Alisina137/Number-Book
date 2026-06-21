import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetBook, getGetBookQueryKey, useGenerateAnalysis } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  FlaskConical, ArrowRight, Loader2, RefreshCw, AlertCircle,
  Users, Layers, List, Compass, Search, BarChart2,
} from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";

interface AudienceAnalysis {
  goals: string[];
  painPoints: string[];
  desires: string[];
  knowledgeLevel: string;
  motivations: string[];
}
interface GapAnalysis {
  commonIdeas: string[];
  uniquePerspectives: string[];
  freshApproaches: string[];
}
interface Recommendations {
  idealEntryCount: number;
  idealWordsPerEntry: string;
  breadth: string;
  complexity: string;
}
interface AnalysisData {
  audienceAnalysis: AudienceAnalysis;
  coreThemes: string[];
  subtopics: string[];
  angles: string[];
  gapAnalysis: GapAnalysis;
  recommendations: Recommendations;
}

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

function AnalysisCard({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-card-border rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const hasAutoTriggered = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: book, isLoading: bookLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const generateAnalysisMutation = useGenerateAnalysis();

  const runGenerate = () => {
    setErrorMessage(null);
    generateAnalysisMutation.mutate(
      { id: bookId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as { message?: string })?.message ??
            "Analysis generation failed. Please try again.";
          setErrorMessage(msg);
        },
      }
    );
  };

  useEffect(() => {
    if (book && book.status === "setup" && !hasAutoTriggered.current && !generateAnalysisMutation.isPending) {
      hasAutoTriggered.current = true;
      runGenerate();
    }
  }, [book?.status]);

  const isGenerating = generateAnalysisMutation.isPending;

  let analysis: AnalysisData | null = null;
  try {
    if (book?.analysisData) analysis = JSON.parse(book.analysisData) as AnalysisData;
  } catch {
    // ignore
  }

  const hasAnalysis = !!analysis;

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-52 flex-shrink-0 border-r border-border bg-muted/30 p-5 flex flex-col gap-6">
        {book && (
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Book Info</h2>
            <div className="space-y-1 text-sm">
              {[
                ["Niche", book.niche],
                ["Sub-Niche", book.subNiche],
                ["Deep Niche", book.deepNiche],
                ["Audience", book.audience],
                ["Tone", book.tone],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <p className="font-medium capitalize text-foreground text-xs">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <BookStepNav bookId={bookId} current="analysis" bookStatus={book?.status} />
      </aside>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <FlaskConical className="w-4 h-4" />
                Step 1 of 6 — Analysis
              </div>
              <h1 className="text-2xl font-semibold">{book?.deepNiche} Analysis</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Deep topic intelligence to power a smarter Blueprint
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
                  <FlaskConical className="w-8 h-8 text-primary mb-4 animate-pulse" />
                  <p className="font-medium text-foreground">Analysing Your Topic</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mapping audience, themes, subtopics, angles, and market gaps…
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
                  <Button className="mt-4 w-full" variant="outline" onClick={runGenerate}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!isGenerating && !errorMessage && hasAnalysis && analysis && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnalysisCard icon={Users} title="Audience Analysis" color="bg-blue-100 text-blue-600">
                    <div className="space-y-2 text-sm">
                      <p className="text-xs text-muted-foreground font-medium">Knowledge Level</p>
                      <p className="text-xs text-foreground">{analysis.audienceAnalysis.knowledgeLevel}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-2">Goals</p>
                      <TagList items={analysis.audienceAnalysis.goals} />
                      <p className="text-xs text-muted-foreground font-medium mt-2">Pain Points</p>
                      <TagList items={analysis.audienceAnalysis.painPoints} />
                      <p className="text-xs text-muted-foreground font-medium mt-2">Motivations</p>
                      <TagList items={analysis.audienceAnalysis.motivations} />
                    </div>
                  </AnalysisCard>

                  <AnalysisCard icon={Layers} title="Core Themes" color="bg-purple-100 text-purple-600">
                    <TagList items={analysis.coreThemes} />
                  </AnalysisCard>

                  <AnalysisCard icon={List} title="Subtopics" color="bg-green-100 text-green-600">
                    <div className="max-h-48 overflow-y-auto">
                      <TagList items={analysis.subtopics} />
                    </div>
                  </AnalysisCard>

                  <AnalysisCard icon={Compass} title="Content Angles" color="bg-orange-100 text-orange-600">
                    <TagList items={analysis.angles} />
                  </AnalysisCard>

                  <AnalysisCard icon={Search} title="Gap Analysis" color="bg-red-100 text-red-600">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Overused Ideas (avoid)</p>
                      <TagList items={analysis.gapAnalysis.commonIdeas} />
                      <p className="text-xs text-muted-foreground font-medium mt-2">Unique Perspectives (prioritise)</p>
                      <TagList items={analysis.gapAnalysis.uniquePerspectives} />
                      <p className="text-xs text-muted-foreground font-medium mt-2">Fresh Approaches</p>
                      <TagList items={analysis.gapAnalysis.freshApproaches} />
                    </div>
                  </AnalysisCard>

                  <AnalysisCard icon={BarChart2} title="Recommendations" color="bg-teal-100 text-teal-600">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ideal entry count</span>
                        <span className="font-medium">{analysis.recommendations.idealEntryCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Words per entry</span>
                        <span className="font-medium">{analysis.recommendations.idealWordsPerEntry}</span>
                      </div>
                      <p className="text-muted-foreground font-medium mt-2">Topic Breadth</p>
                      <p className="text-foreground">{analysis.recommendations.breadth}</p>
                      <p className="text-muted-foreground font-medium mt-2">Complexity</p>
                      <p className="text-foreground">{analysis.recommendations.complexity}</p>
                    </div>
                  </AnalysisCard>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={runGenerate} disabled={isGenerating} className="flex-shrink-0">
                    <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => setLocation(`/books/${bookId}/resources`)}
                  >
                    Continue to Resources
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
