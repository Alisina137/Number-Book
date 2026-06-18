import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, BookOpen, Trash2, ArrowRight, Clock, CheckCircle, FileText } from "lucide-react";
import { useListBooks, useDeleteBook, getListBooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Book } from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  setup: "Setup",
  blueprint: "Blueprint Ready",
  writing: "Writing",
  quality: "Quality Check",
  finished: "Finished",
};

const STATUS_COLORS: Record<string, string> = {
  setup: "bg-muted text-muted-foreground",
  blueprint: "bg-blue-100 text-blue-700",
  writing: "bg-amber-100 text-amber-700",
  quality: "bg-purple-100 text-purple-700",
  finished: "bg-green-100 text-green-700",
};

function getBookRoute(book: Book): string {
  if (book.status === "setup") return `/books/${book.id}/blueprint`;
  if (book.status === "blueprint") return `/books/${book.id}/write`;
  if (book.status === "writing") return `/books/${book.id}/write`;
  if (book.status === "quality") return `/books/${book.id}/quality`;
  if (book.status === "finished") return `/books/${book.id}/export`;
  return `/books/${book.id}/write`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: books, isLoading } = useListBooks();
  const deleteMutation = useDeleteBook();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this book and all its entries?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          toast({ title: "Book deleted" });
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Your Books</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {books?.length ?? 0} book{books?.length !== 1 ? "s" : ""} in your studio
            </p>
          </div>
          <Button onClick={() => setLocation("/books/new")} data-testid="button-new-book">
            <Plus className="w-4 h-4 mr-2" />
            New Book
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !books || books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-5">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No books yet</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Create your first numbered entry book. Fun Facts, Trivia, Jokes — any format you choose.
            </p>
            <Button onClick={() => setLocation("/books/new")} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Book
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map((book, i) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setLocation(getBookRoute(book))}
                className="group bg-card border border-card-border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
                data-testid={`card-book-${book.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
                      {book.niche}
                    </p>
                    <h3 className="font-semibold text-foreground text-base leading-snug truncate">
                      {book.deepNiche || book.subNiche}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5 capitalize">{book.audience} · {book.tone}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(book.id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    data-testid={`button-delete-${book.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs px-2 py-0.5 ${STATUS_COLORS[book.status] ?? STATUS_COLORS.setup}`}>
                      {STATUS_LABELS[book.status] ?? book.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {book.numEntries} entries
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
