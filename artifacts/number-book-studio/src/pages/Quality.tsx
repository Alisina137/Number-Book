import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetBook,
  getGetBookQueryKey,
  useGetQualityReport,
  getGetQualityReportQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { BookStepNav } from "@/components/BookStepNav";

const ISSUE_LABELS: Record<string, string> = {
  duplicate: "Duplicate",
  near_duplicate: "Near Duplicate",
  word_count: "Word Count",
  audience: "Audience",
  template_structure: "Structure",
};

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
};

export default function Quality() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();

  const { data: book } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });
  const { data: report, isLoading } = useGetQualityReport(bookId, {
    query: { enabled: !!bookId, queryKey: getGetQualityReportQueryKey(bookId) },
  });

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
        <BookStepNav bookId={bookId} current="quality" />
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <p className="text-muted-foreground text-sm mb-1">Step 3 of 4 — Quality Control</p>
              <h1 className="text-2xl font-semibold">{book?.deepNiche} — Quality Report</h1>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : report ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "Total Entries", value: report.totalEntries, icon: null },
                    {
                      label: "Passed",
                      value: report.passedEntries,
                      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
                      color: "text-green-700",
                    },
                    {
                      label: "Issues",
                      value: report.failedEntries,
                      icon: <XCircle className="w-4 h-4 text-red-600" />,
                      color: "text-red-700",
                    },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        {icon}
                        <span className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Issues */}
                {report.issues.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-green-50 border border-green-200 rounded-xl p-8 flex flex-col items-center text-center"
                  >
                    <CheckCircle className="w-10 h-10 text-green-600 mb-3" />
                    <p className="font-semibold text-green-800">All entries passed quality checks</p>
                    <p className="text-sm text-green-700 mt-1">Your book is ready for export.</p>
                  </motion.div>
                ) : (
                  <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-6">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium">{report.issues.length} issue{report.issues.length !== 1 ? "s" : ""} found</span>
                    </div>
                    <div className="divide-y divide-border">
                      {report.issues.map((issue, i) => (
                        <motion.div
                          key={`${issue.entryId}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="px-5 py-3.5"
                          data-testid={`issue-${issue.entryId}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex gap-1.5 mt-0.5 flex-shrink-0">
                              <Badge className={`text-xs px-1.5 py-0.5 ${SEVERITY_STYLES[issue.severity] ?? ""}`}>
                                {issue.severity}
                              </Badge>
                              <Badge className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground">
                                {ISSUE_LABELS[issue.issueType] ?? issue.issueType}
                              </Badge>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{issue.entryTitle}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => setLocation(`/books/${bookId}/export`)} className="w-full" data-testid="button-go-export">
                  Export Book
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
