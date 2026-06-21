import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useListEntries,
  getListEntriesQueryKey,
  useGetBookStats,
  getGetBookStatsQueryKey,
  useGenerateEntry,
  useUpdateEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { Entry } from "@workspace/api-client-react";
import { BookStepNav } from "@/components/BookStepNav";

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  generating: <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />,
  done: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-destructive" />,
};

function EntryRow({ entry, bookId }: { entry: Entry; bookId: number }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generateEntry = useGenerateEntry();
  const updateEntry = useUpdateEntry();

  const isGenerating = generateEntry.isPending && generateEntry.variables?.entryId === entry.id;

  const handleGenerate = () => {
    generateEntry.mutate(
      { bookId, entryId: entry.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
          queryClient.invalidateQueries({ queryKey: getGetBookStatsQueryKey(bookId) });
          setExpanded(true);
        },
        onError: () => {
          toast({ title: "Generation failed", variant: "destructive" });
        },
      }
    );
  };

  const handleLock = () => {
    updateEntry.mutate(
      { bookId, entryId: entry.id, data: { isLocked: !entry.isLocked } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
        },
      }
    );
  };

  return (
    <motion.div
      layout
      className="border border-card-border rounded-lg overflow-hidden bg-card"
      data-testid={`entry-row-${entry.id}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-mono text-muted-foreground w-6 flex-shrink-0">{entry.position}.</span>
        {STATUS_ICON[isGenerating ? "generating" : entry.status] ?? STATUS_ICON.pending}

        <button
          onClick={() => entry.status === "done" && setExpanded((e) => !e)}
          className="flex-1 text-left text-sm font-medium text-foreground truncate"
        >
          {entry.title}
        </button>

        {entry.wordCount && (
          <span className="text-xs text-muted-foreground flex-shrink-0">{entry.wordCount}w</span>
        )}

        {entry.isLocked && (
          <Badge className="text-xs bg-amber-100 text-amber-700 flex-shrink-0">Locked</Badge>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {entry.status === "done" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={entry.isLocked || isGenerating}
              className="h-7 text-xs px-2"
              data-testid={`button-regenerate-${entry.id}`}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-7 text-xs px-2"
              data-testid={`button-generate-${entry.id}`}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {isGenerating ? "Writing..." : "Generate"}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLock}
            disabled={entry.status !== "done"}
            className="h-7 w-7 p-0"
            data-testid={`button-lock-${entry.id}`}
          >
            {entry.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>

          {entry.status === "done" && (
            <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground transition-colors ml-0.5">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && entry.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {entry.content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Write() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();

  const { data: book } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });
  const { data: entries, isLoading } = useListEntries(bookId, {
    query: { enabled: !!bookId, queryKey: getListEntriesQueryKey(bookId) },
  });
  const { data: stats } = useGetBookStats(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookStatsQueryKey(bookId) },
  });

  return (
    <div className="flex h-full min-h-screen">
      {/* Left panel */}
      <aside className="w-60 flex-shrink-0 border-r border-border bg-muted/30 p-5 flex flex-col gap-6">
        {book && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Book Info</h2>
            <div className="space-y-1.5 text-sm">
              {[
                ["Niche", book.niche],
                ["Sub-Niche", book.subNiche],
                ["Deep Niche", book.deepNiche],
                ["Audience", book.audience],
                ["Tone", book.tone],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <p className="font-medium capitalize text-foreground">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-semibold text-foreground">{stats.completedEntries}/{stats.totalEntries}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.completionPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{stats.completionPercentage}% complete</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Remaining", stats.remainingEntries],
                ["Locked", stats.lockedEntries],
                ["Total Words", stats.totalWordCount],
                ["Avg Words", Math.round(stats.averageWordsPerEntry)],
              ].map(([label, val]) => (
                <div key={label} className="bg-card border border-card-border rounded-lg p-2 text-center">
                  <p className="font-semibold text-foreground">{val}</p>
                  <p className="text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <BookStepNav bookId={bookId} current="write" bookStatus={book?.status} />
      </aside>

      {/* Entry list */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-semibold">Writing</h1>
            <span className="text-sm text-muted-foreground">{entries?.length ?? 0} entries</span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {entries?.map((entry) => (
                <EntryRow key={entry.id} entry={entry} bookId={bookId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
