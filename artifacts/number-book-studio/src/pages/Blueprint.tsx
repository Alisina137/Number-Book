import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useGenerateBlueprint,
  useListEntries,
  getListEntriesQueryKey,
  useUpdateBook,
  useRegenerateEntryTitle,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";
import type { Entry } from "@workspace/api-client-react";

function EntryRow({ entry, bookId }: { entry: Entry; bookId: number }) {
  const queryClient = useQueryClient();
  const regenerateTitle = useRegenerateEntryTitle();
  const isRegenerating = regenerateTitle.isPending && regenerateTitle.variables?.entryId === entry.id;

  const handleRegenerate = () => {
    regenerateTitle.mutate(
      { bookId, entryId: entry.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
        },
      }
    );
  };

  return (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
      data-testid={`entry-title-${entry.id}`}
    >
      <span className="text-xs font-mono text-muted-foreground w-8 flex-shrink-0 text-right">
        {entry.position}.
      </span>
      <span className="text-sm text-foreground flex-1 min-w-0">
        {isRegenerating ? (
          <span className="text-muted-foreground italic flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin inline" />
            Regenerating…
          </span>
        ) : (
          entry.title
        )}
      </span>
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating}
        title="Regenerate this title"
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30"
        data-testid={`button-regen-title-${entry.id}`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
      </button>
    </motion.div>
  );
}

export default function Blueprint() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const hasAutoTriggered = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: book, isLoading: bookLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const { data: entries, isLoading: entriesLoading } = useListEntries(bookId, {
    query: {
      enabled: !!bookId && !!book && book.status !== "setup",
      queryKey: getListEntriesQueryKey(bookId),
    },
  });

  const generateBlueprintMutation = useGenerateBlueprint();
  const updateBook = useUpdateBook();

  const runGenerate = () => {
    setErrorMessage(null);
    generateBlueprintMutation.mutate(
      { id: bookId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            (err as { message?: string })?.message ??
            "Blueprint generation failed. Please try again.";
          setErrorMessage(msg);
        },
      }
    );
  };

  useEffect(() => {
    if (book && book.status === "setup" && !hasAutoTriggered.current && !generateBlueprintMutation.isPending) {
      hasAutoTriggered.current = true;
      runGenerate();
    }
  }, [book?.status]);

  const handleProceed = () => {
    updateBook.mutate(
      { id: bookId, data: { status: "writing" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          setLocation(`/books/${bookId}/write`);
        },
      }
    );
  };

  const isGenerating = generateBlueprintMutation.isPending;
  const hasEntries = entries && entries.length > 0;

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
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
        <BookStepNav bookId={bookId} current="blueprint" />
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                <BookOpen className="w-4 h-4" />
                Step 1 of 4 — Blueprint
              </div>
              <h1 className="text-2xl font-semibold">{book?.deepNiche} Blueprint</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {book?.numEntries} unique entry titles for your {book?.niche?.toLowerCase()} book
              </p>
            </div>

            {/* Generating state */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-accent/50 border border-accent-border rounded-xl p-8 flex flex-col items-center text-center mb-6"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="font-medium text-foreground">Generating Blueprint</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Creating {book?.numEntries} unique entry titles with AI...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error state */}
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
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    onClick={runGenerate}
                    data-testid="button-retry"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Entry list */}
            {!isGenerating && !errorMessage && hasEntries && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">{entries.length} entries generated</span>
                    </div>
                    <button
                      onClick={runGenerate}
                      disabled={isGenerating}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-40"
                      data-testid="button-regenerate-blueprint"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate all
                    </button>
                  </div>
                  <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                    {entries.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.5) }}
                      >
                        <EntryRow entry={entry} bookId={bookId} />
                      </motion.div>
                    ))}
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleProceed}
                  disabled={updateBook.isPending}
                  data-testid="button-proceed-writing"
                >
                  Proceed to Writing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Manual generate button when not loading and no entries and no error */}
            {!isGenerating && !errorMessage && !hasEntries && !entriesLoading && book?.status !== "setup" && (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No entries found. Try generating the blueprint.</p>
                <Button onClick={runGenerate} data-testid="button-generate-now">
                  Generate Blueprint
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
