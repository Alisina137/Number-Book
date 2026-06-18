import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useGenerateBlueprint,
  useListEntries,
  getListEntriesQueryKey,
  useUpdateBook,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ArrowRight, Loader2, RefreshCw, CheckCircle } from "lucide-react";

export default function Blueprint() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [hasTriggered, setHasTriggered] = useState(false);

  const { data: book, isLoading: bookLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const { data: entries, isLoading: entriesLoading } = useListEntries(bookId, {
    query: { enabled: !!bookId && book?.status !== "setup", queryKey: getListEntriesQueryKey(bookId) },
  });

  const generateBlueprint = useGenerateBlueprint();
  const updateBook = useUpdateBook();

  // Auto-trigger if book is in setup state and we haven't triggered yet
  useEffect(() => {
    if (book && book.status === "setup" && !hasTriggered && !generateBlueprint.isPending) {
      setHasTriggered(true);
      generateBlueprint.mutate(
        { id: bookId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
          },
          onError: () => {
            toast({ title: "Blueprint generation failed", description: "Please try again", variant: "destructive" });
          },
        }
      );
    }
  }, [book, hasTriggered]);

  const handleRegenerate = () => {
    setHasTriggered(true);
    generateBlueprint.mutate(
      { id: bookId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(bookId) });
          toast({ title: "Blueprint regenerated" });
        },
        onError: () => {
          toast({ title: "Failed to regenerate", variant: "destructive" });
        },
      }
    );
  };

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

  const isGenerating = generateBlueprint.isPending;
  const hasEntries = entries && entries.length > 0;

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <BookOpen className="w-4 h-4" />
            Step 2 of 4 — Blueprint
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

        {/* Entry list */}
        {!isGenerating && hasEntries && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">{entries.length} entries generated</span>
                </div>
                <button
                  onClick={handleRegenerate}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                  data-testid="button-regenerate-blueprint"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {entries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.5) }}
                    className="flex items-baseline gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    data-testid={`entry-title-${entry.id}`}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-8 flex-shrink-0 text-right">
                      {entry.position}.
                    </span>
                    <span className="text-sm text-foreground">{entry.title}</span>
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

        {!isGenerating && !hasEntries && !entriesLoading && book?.status !== "setup" && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No entries found. Try generating the blueprint.</p>
            <Button onClick={handleRegenerate} data-testid="button-generate-now">
              Generate Blueprint
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
