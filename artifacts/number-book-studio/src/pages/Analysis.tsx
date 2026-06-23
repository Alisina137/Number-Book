import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useGenerateAnalysis,
  useSuggestCompetitors,
  useAddCompetitor,
  useRemoveCompetitor,
  useAnalyzeCompetitors,
  useSuggestTitles,
  useUpdateBook,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FlaskConical, ArrowRight, Loader2, RefreshCw, AlertCircle,
  Users, Layers, List, Compass, Search, BarChart2,
  Trophy, ThumbsUp, ThumbsDown, Target, Lightbulb, Plus,
  X, Sparkles, BookOpen, TrendingUp, Zap, Type, Check,
} from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface CompetitorScore {
  contentDepth: number;
  readerSatisfaction: number;
  structure: number;
  authority: number;
  differentiationOpportunity: number;
}
interface CompetitorThemes {
  majorThemes: string[];
  recurringConcepts: string[];
  frameworks: string[];
  methodologies: string[];
  terminology: string[];
}
interface CompetitorBook {
  id: string;
  title: string;
  author?: string;
  subtitle?: string;
  addedVia: "url" | "isbn" | "title" | "manual" | "suggested";
  analyzed: boolean;
  category?: string;
  publicationYear?: number;
  pageCount?: number;
  ratings?: number;
  reviewCount?: number;
  competitorThemes?: CompetitorThemes;
  readerLikes?: string[];
  readerDislikes?: string[];
  positiveSignals?: string[];
  negativeSignals?: string[];
  scores?: CompetitorScore;
}
interface CompetitorData {
  competitors: CompetitorBook[];
  winningPatterns?: string[];
  marketGaps?: string[];
  bookAdvantageStrategy?: string;
  synthesized?: boolean;
}
interface CompetitorSuggestion {
  title: string;
  author: string;
  reason: string;
  rating?: number;
  reviewCount?: number;
  asin?: string;
  amazonUrl?: string;
  image?: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function TagList({ items, variant = "default" }: { items: string[]; variant?: "default" | "green" | "red" }) {
  const cls =
    variant === "green"
      ? "bg-green-50 text-green-700 border border-green-200"
      : variant === "red"
      ? "bg-red-50 text-red-700 border border-red-200"
      : "bg-muted text-foreground";
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span key={i} className={`text-xs px-2 py-1 rounded-full ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function AnalysisCard({
  icon: Icon, title, color, children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl p-5">
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

function ScoreBar({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  const pct = Math.round((value / 10) * 100);
  const color = accent
    ? "bg-orange-500"
    : value >= 7
    ? "bg-green-500"
    : value >= 5
    ? "bg-yellow-400"
    : "bg-red-400";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${accent ? "text-orange-600" : value >= 7 ? "text-green-600" : value >= 5 ? "text-yellow-600" : "text-red-600"}`}>{value}/10</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Competitor Card ───────────────────────────────────────────────────────────

function CompetitorCard({ competitor, onRemove, isRemoving }: { competitor: CompetitorBook; onRemove: () => void; isRemoving: boolean }) {
  const [tab, setTab] = useState<"scores" | "insights" | "themes">("scores");

  const addedViaLabel: Record<string, string> = {
    suggested: "AI Suggested",
    manual: "Manual",
    url: "Amazon URL",
    isbn: "ISBN",
    title: "Title Search",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{competitor.title}</p>
          {competitor.author && <p className="text-xs text-muted-foreground">{competitor.author}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              {addedViaLabel[competitor.addedVia] ?? competitor.addedVia}
            </span>
            {competitor.category && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                {competitor.category}
              </span>
            )}
            {competitor.publicationYear && (
              <span className="text-[10px] text-muted-foreground">{competitor.publicationYear}</span>
            )}
            {competitor.ratings && (
              <span className="text-[10px] text-yellow-600">★ {competitor.ratings}</span>
            )}
            {competitor.reviewCount && (
              <span className="text-[10px] text-muted-foreground">{competitor.reviewCount.toLocaleString()} reviews</span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        >
          {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!competitor.analyzed ? (
        <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analysing competitor with AI…
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-0.5 text-xs">
            {(["scores", "insights", "themes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1 rounded-md font-medium capitalize transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "scores" ? "Scores" : t === "insights" ? "Reader Insights" : "Themes"}
              </button>
            ))}
          </div>

          {/* Scores tab */}
          {tab === "scores" && competitor.scores && (
            <div className="space-y-2.5">
              <ScoreBar label="Content Depth" value={competitor.scores.contentDepth} />
              <ScoreBar label="Reader Satisfaction" value={competitor.scores.readerSatisfaction} />
              <ScoreBar label="Structure" value={competitor.scores.structure} />
              <ScoreBar label="Authority" value={competitor.scores.authority} />
              <ScoreBar label="Opportunity to Beat" value={competitor.scores.differentiationOpportunity} accent />
            </div>
          )}

          {/* Insights tab */}
          {tab === "insights" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <ThumbsUp className="w-3 h-3 text-green-500" />
                  <p className="text-xs font-medium text-green-700">Readers Love</p>
                </div>
                {competitor.readerLikes?.map((item, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">• {item}</p>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <ThumbsDown className="w-3 h-3 text-red-500" />
                  <p className="text-xs font-medium text-red-700">Readers Dislike</p>
                </div>
                {competitor.readerDislikes?.map((item, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">• {item}</p>
                ))}
              </div>
              {competitor.positiveSignals && competitor.positiveSignals.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-foreground mb-1">Top Positive Signals</p>
                  <div className="flex flex-wrap gap-1">
                    {competitor.positiveSignals.map((s, i) => (
                      <span key={i} className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">
                        {i + 1}. {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {competitor.negativeSignals && competitor.negativeSignals.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-foreground mb-1">Top Negative Signals</p>
                  <div className="flex flex-wrap gap-1">
                    {competitor.negativeSignals.map((s, i) => (
                      <span key={i} className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                        {i + 1}. {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Themes tab */}
          {tab === "themes" && competitor.competitorThemes && (
            <div className="space-y-2">
              {competitor.competitorThemes.majorThemes?.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Major Themes</p>
                  <TagList items={competitor.competitorThemes.majorThemes} />
                </>
              )}
              {competitor.competitorThemes.frameworks?.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2">Frameworks</p>
                  <TagList items={competitor.competitorThemes.frameworks} />
                </>
              )}
              {competitor.competitorThemes.methodologies?.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2">Methodologies</p>
                  <TagList items={competitor.competitorThemes.methodologies} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Title Suggestions Panel ──────────────────────────────────────────────────

interface TitleSuggestion {
  title: string;
  subtitle: string;
  fullTitle: string;
  rationale: string;
}

function TitleSuggestionsPanel({ bookId, currentTitle, onTitleApplied }: {
  bookId: number;
  currentTitle?: string | null;
  onTitleApplied: () => void;
}) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

  const suggestMutation = useSuggestTitles();
  const updateBook = useUpdateBook();

  const handleSuggest = () => {
    setError(null);
    setSuggestions([]);
    setAppliedIdx(null);
    suggestMutation.mutate(
      { id: bookId },
      {
        onSuccess: (data) => setSuggestions(data.suggestions ?? []),
        onError: (err: unknown) => {
          setError(
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? "Title suggestion failed"
          );
        },
      }
    );
  };

  const applyTitle = (suggestion: TitleSuggestion, idx: number) => {
    updateBook.mutate(
      { id: bookId, data: { title: suggestion.fullTitle } },
      {
        onSuccess: () => {
          setAppliedIdx(idx);
          onTitleApplied();
        },
      }
    );
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-medium text-sm text-foreground">Book Title</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSuggest}
          disabled={suggestMutation.isPending}
          className="h-7 text-xs gap-1.5"
        >
          {suggestMutation.isPending
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
            : <><Sparkles className="w-3 h-3" /> Suggest 3 Titles</>}
        </Button>
      </div>

      {currentTitle && suggestions.length === 0 && !suggestMutation.isPending && (
        <p className="text-sm text-foreground font-medium mt-2 truncate">{currentTitle}</p>
      )}
      {!currentTitle && suggestions.length === 0 && !suggestMutation.isPending && (
        <p className="text-xs text-muted-foreground mt-2">No title set yet — click "Suggest 3 Titles" to generate AI-powered options based on your niche and market data.</p>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3">
          {suggestions.map((s, i) => {
            const isApplied = appliedIdx === i;
            const isApplying = updateBook.isPending && appliedIdx === null;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`rounded-lg border p-3.5 transition-colors ${isApplied ? "border-green-400 bg-green-50/50" : "border-border bg-muted/30 hover:bg-muted/60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-snug">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.subtitle}</p>
                    <p className="text-[11px] text-primary/80 mt-1.5 italic">{s.rationale}</p>
                  </div>
                  <button
                    onClick={() => applyTitle(s, i)}
                    disabled={isApplied || isApplying}
                    className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors mt-0.5 ${
                      isApplied
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isApplied
                      ? <><Check className="w-3 h-3" /> Applied</>
                      : "Use This"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Competitor Intelligence Section ──────────────────────────────────────────

function CompetitorSection({ bookId, competitorData, onUpdate }: { bookId: number; competitorData: CompetitorData; onUpdate: () => void }) {
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const suggestMutation = useSuggestCompetitors();
  const addMutation = useAddCompetitor();
  const removeMutation = useRemoveCompetitor();
  const analyzeMutation = useAnalyzeCompetitors();

  const competitors = competitorData.competitors ?? [];
  const analyzedCount = competitors.filter((c) => c.analyzed).length;
  const hasCompetitors = competitors.length > 0;
  const alreadyAddedTitles = new Set(competitors.map((c) => c.title.toLowerCase()));

  const loadSuggestions = () => {
    setSuggestError(null);
    suggestMutation.mutate(
      { id: bookId },
      {
        onSuccess: (data) => setSuggestions(data.suggestions ?? []),
        onError: (err: unknown) => {
          setSuggestError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to load suggestions");
        },
      }
    );
  };

  const addCompetitor = (
    title: string,
    author?: string,
    addedVia: "suggested" | "manual" = "suggested",
    extra?: { asin?: string; amazonUrl?: string; rating?: number; reviewCount?: number }
  ) => {
    const tempId = title;
    setAddingIds((prev) => new Set(prev).add(tempId));
    setManualError(null);
    addMutation.mutate(
      { id: bookId, data: { title, author: author ?? undefined, addedVia, ...extra } },
      {
        onSuccess: () => {
          onUpdate();
          setAddingIds((prev) => { const s = new Set(prev); s.delete(tempId); return s; });
          if (addedVia === "manual") {
            setManualTitle("");
            setManualAuthor("");
            setIsAddingManual(false);
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to add competitor";
          if (addedVia === "manual") setManualError(msg);
          setAddingIds((prev) => { const s = new Set(prev); s.delete(tempId); return s; });
        },
      }
    );
  };

  const removeCompetitor = (competitorId: string) => {
    setRemovingIds((prev) => new Set(prev).add(competitorId));
    removeMutation.mutate(
      { id: bookId, competitorId },
      {
        onSuccess: () => {
          onUpdate();
          setRemovingIds((prev) => { const s = new Set(prev); s.delete(competitorId); return s; });
        },
        onError: () => setRemovingIds((prev) => { const s = new Set(prev); s.delete(competitorId); return s; }),
      }
    );
  };

  const synthesize = () => {
    analyzeMutation.mutate(
      { id: bookId },
      {
        onSuccess: () => onUpdate(),
      }
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
          <Trophy className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Competitor Intelligence</h2>
          <p className="text-xs text-muted-foreground">Analyse top books in your niche to identify market gaps and winning patterns</p>
        </div>
      </div>

      {/* AI suggestions panel */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm text-foreground">AI-Suggested Bestsellers</h3>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadSuggestions}
            disabled={suggestMutation.isPending}
            className="h-7 text-xs"
          >
            {suggestMutation.isPending ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading…</>
            ) : suggestions.length > 0 ? (
              <><RefreshCw className="w-3 h-3 mr-1" /> Refresh</>
            ) : (
              <><Sparkles className="w-3 h-3 mr-1" /> Search Amazon</>

            )}
          </Button>
        </div>

        {suggestError && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">{suggestError}</p>
        )}

        {suggestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((s, i) => {
              const alreadyAdded = alreadyAddedTitles.has(s.title.toLowerCase());
              const isAdding = addingIds.has(s.title);
              return (
                <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
                  {/* Book cover thumbnail */}
                  {s.image ? (
                    <img
                      src={s.image}
                      alt={s.title}
                      className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.author}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {s.rating && (
                        <span className="text-[10px] text-yellow-600 font-medium">★ {s.rating}</span>
                      )}
                      {s.reviewCount && (
                        <span className="text-[10px] text-muted-foreground">
                          {s.reviewCount.toLocaleString()} reviews
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      addCompetitor(s.title, s.author, "suggested", {
                        asin: s.asin,
                        amazonUrl: s.amazonUrl,
                        rating: s.rating,
                        reviewCount: s.reviewCount,
                      })
                    }
                    disabled={alreadyAdded || isAdding}
                    className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors self-center ${
                      alreadyAdded
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : alreadyAdded ? "Added ✓" : <><Plus className="w-3 h-3" /> Add</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {suggestions.length === 0 && !suggestMutation.isPending && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Click "Search Amazon" to find real bestselling books in your niche
          </p>
        )}
      </div>

      {/* Manual add */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium text-sm text-foreground">Add Competitor Manually</h3>
          </div>
          {!isAddingManual && (
            <Button size="sm" variant="outline" onClick={() => setIsAddingManual(true)} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Add Book
            </Button>
          )}
        </div>
        <AnimatePresence>
          {isAddingManual && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Book title (required)"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Author (optional)"
                  value={manualAuthor}
                  onChange={(e) => setManualAuthor(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {manualError && <p className="text-xs text-destructive">{manualError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!manualTitle.trim() || addMutation.isPending}
                  onClick={() => addCompetitor(manualTitle.trim(), manualAuthor.trim() || undefined, "manual")}
                  className="h-7 text-xs"
                >
                  {addMutation.isPending && addingIds.has(manualTitle) ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analysing…</>
                  ) : (
                    "Add & Analyse"
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsAddingManual(false); setManualTitle(""); setManualAuthor(""); setManualError(null); }} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!isAddingManual && (
          <p className="text-xs text-muted-foreground">Enter any competitor's book title to have AI analyse it.</p>
        )}
      </div>

      {/* Competitor list */}
      {hasCompetitors && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Competitors <span className="text-muted-foreground font-normal">({competitors.length})</span>
            </h3>
            {analyzedCount > 0 && (
              <span className="text-xs text-muted-foreground">{analyzedCount} analysed</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {competitors.map((c) => (
              <CompetitorCard
                key={c.id}
                competitor={c}
                onRemove={() => removeCompetitor(c.id)}
                isRemoving={removingIds.has(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Synthesize button */}
      {analyzedCount >= 1 && !competitorData.synthesized && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">Ready to synthesize intelligence</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will cross-reference {analyzedCount} competitor{analyzedCount > 1 ? "s" : ""} to find winning patterns, market gaps, and your differentiation strategy.
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={synthesize}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Synthesising…</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> Synthesise Competitor Intelligence</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Synthesis results */}
      {competitorData.synthesized && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center">
              <TrendingUp className="w-3 h-3" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Intelligence Synthesis</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Winning Patterns */}
            {competitorData.winningPatterns && competitorData.winningPatterns.length > 0 && (
              <AnalysisCard icon={TrendingUp} title="Winning Patterns" color="bg-green-100 text-green-600">
                <div className="space-y-1.5">
                  {competitorData.winningPatterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-green-500 font-bold flex-shrink-0">✓</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </AnalysisCard>
            )}

            {/* Market Gaps */}
            {competitorData.marketGaps && competitorData.marketGaps.length > 0 && (
              <AnalysisCard icon={Target} title="Market Gaps" color="bg-orange-100 text-orange-600">
                <div className="space-y-1.5">
                  {competitorData.marketGaps.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-orange-500 font-bold flex-shrink-0">→</span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </AnalysisCard>
            )}

            {/* Differentiation Strategy */}
            {competitorData.bookAdvantageStrategy && (
              <div className="md:col-span-2">
                <AnalysisCard icon={Lightbulb} title="Your Differentiation Strategy" color="bg-purple-100 text-purple-600">
                  <p className="text-xs text-foreground leading-relaxed">{competitorData.bookAdvantageStrategy}</p>
                </AnalysisCard>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={synthesize}
            disabled={analyzeMutation.isPending}
            className="text-xs"
          >
            {analyzeMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Synthesising…</> : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-synthesise</>}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) }),
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

  const refreshBook = () => queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });

  const isGenerating = generateAnalysisMutation.isPending;

  let analysis: AnalysisData | null = null;
  let competitorData: CompetitorData = { competitors: [] };
  try {
    if (book?.analysisData) analysis = JSON.parse(book.analysisData) as AnalysisData;
  } catch {}
  try {
    if (book?.competitorData) competitorData = JSON.parse(book.competitorData) as CompetitorData;
  } catch {}

  const hasAnalysis = !!analysis;

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
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
                Deep topic intelligence and competitor analysis to power a smarter Blueprint
              </p>
            </div>

            {/* Title Suggestions */}
            {book && (
              <TitleSuggestionsPanel
                bookId={bookId}
                currentTitle={book.title}
                onTitleApplied={() => queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) })}
              />
            )}

            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-accent/50 border border-accent-border rounded-xl p-10 flex flex-col items-center text-center mb-6"
                >
                  <FlaskConical className="w-8 h-8 text-primary mb-4 animate-pulse" />
                  <p className="font-medium text-foreground">Analysing Your Topic</p>
                  <p className="text-sm text-muted-foreground mt-1">Mapping audience, themes, subtopics, angles, and market gaps…</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isGenerating && !errorMessage && !hasAnalysis && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-muted/50 border border-border rounded-xl p-10 flex flex-col items-center text-center mb-6"
                >
                  <FlaskConical className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="font-medium text-foreground">No analysis yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Run analysis to generate topic intelligence for this book.</p>
                  <Button onClick={runGenerate}>
                    <FlaskConical className="w-4 h-4 mr-2" /> Run Analysis
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isGenerating && errorMessage && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                {/* Topic Analysis Cards */}
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

                {/* Regenerate analysis */}
                <div className="flex justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={runGenerate} disabled={isGenerating} className="text-xs">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate Analysis
                  </Button>
                </div>

                {/* ─── Competitor Intelligence ─── */}
                <CompetitorSection
                  bookId={bookId}
                  competitorData={competitorData}
                  onUpdate={refreshBook}
                />

                {/* Continue button */}
                <div className="pt-4 border-t border-border">
                  <Button
                    size="lg"
                    className="w-full"
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
