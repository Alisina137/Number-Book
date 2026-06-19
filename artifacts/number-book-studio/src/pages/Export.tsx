import { useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useGetBookStats,
  getGetBookStatsQueryKey,
  useExportBook,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2 } from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";

type ExportFormat = "txt" | "markdown";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: "txt", label: "Plain Text (.txt)", desc: "Clean text, works everywhere" },
  { value: "markdown", label: "Markdown (.md)", desc: "Formatted with headers and structure" },
];

export default function Export() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const { toast } = useToast();

  const [format, setFormat] = useState<ExportFormat>("txt");
  const [includeConclusion, setIncludeConclusion] = useState(true);
  const [authorName, setAuthorName] = useState("");

  const { data: book } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });
  const { data: stats } = useGetBookStats(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookStatsQueryKey(bookId) },
  });

  const exportBook = useExportBook();

  const handleExport = () => {
    exportBook.mutate(
      {
        id: bookId,
        data: { format, includeConclusion, authorName: authorName || undefined },
      },
      {
        onSuccess: (result) => {
          const blob = new Blob([result.content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "Book exported successfully" });
        },
        onError: () => {
          toast({ title: "Export failed", variant: "destructive" });
        },
      }
    );
  };

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
        <BookStepNav bookId={bookId} current="export" />
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <p className="text-muted-foreground text-sm mb-1">Step 4 of 4 — Finish & Export</p>
              <h1 className="text-2xl font-semibold">Export Your Book</h1>
            </div>

            {/* Book Stats */}
            {book && stats && (
              <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
                <h2 className="text-sm font-medium text-foreground mb-3">Book Statistics</h2>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
                  {[
                    ["Niche", book.niche],
                    ["Sub-Niche", book.subNiche],
                    ["Deep Niche", book.deepNiche],
                    ["Audience", book.audience],
                    ["Tone", book.tone],
                    ["Total Entries", stats.totalEntries],
                    ["Completed", stats.completedEntries],
                    ["Total Words", stats.totalWordCount.toLocaleString()],
                    ["Avg Words/Entry", Math.round(stats.averageWordsPerEntry)],
                    ["Generation Date", new Date(book.createdAt).toLocaleDateString()],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className="font-medium capitalize text-foreground text-xs text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export options */}
            <div className="bg-card border border-card-border rounded-xl p-5 mb-6 space-y-5">
              <h2 className="text-sm font-medium text-foreground">Export Options</h2>

              <div>
                <Label className="text-xs mb-2 block">Format</Label>
                <div className="space-y-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormat(opt.value)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        format === opt.value
                          ? "border-primary bg-accent/50"
                          : "border-border hover:border-muted-foreground"
                      }`}
                      data-testid={`format-${opt.value}`}
                    >
                      <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${format === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`text-sm font-medium ${format === opt.value ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Author Name (optional)</Label>
                <Input
                  placeholder={book?.authorName ?? "Your name"}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  data-testid="input-export-author"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="conclusion"
                  checked={includeConclusion}
                  onChange={(e) => setIncludeConclusion(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-conclusion"
                />
                <Label htmlFor="conclusion" className="text-sm font-normal cursor-pointer">
                  Include conclusion section
                </Label>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleExport}
              disabled={exportBook.isPending}
              data-testid="button-export"
            >
              {exportBook.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exportBook.isPending ? "Assembling book..." : "Download Book"}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
