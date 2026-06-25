import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetBook,
  useUpdateBook,
  useSuggestTitles,
  getGetBookQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { BookStepNav } from "@/components/BookStepNav";
import { Layers, ArrowRight, Save, Loader2, AlertCircle, Sparkles, ChevronRight } from "lucide-react";

const schema = z.object({
  title: z.string().optional().default(""),
  authorName: z.string().optional().default(""),
});

type FormValues = z.infer<typeof schema>;

export default function Structure() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: book, isLoading, isError } = useGetBook(bookId);
  const updateBook = useUpdateBook();
  const suggestTitles = useSuggestTitles();
  const [titleSuggestions, setTitleSuggestions] = useState<
    Array<{ title: string; subtitle: string; fullTitle: string; rationale: string }>
  >([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", authorName: "" },
  });

  useEffect(() => {
    if (book) {
      form.reset({
        title: book.title ?? "",
        authorName: book.authorName ?? "",
      });
    }
  }, [book]);

  const onSave = (values: FormValues) => {
    if (!book) return;
    updateBook.mutate(
      {
        id: bookId,
        data: {
          niche: book.niche,
          subNiche: book.subNiche,
          deepNiche: book.deepNiche ?? "",
          audience: book.audience as "children" | "teenagers" | "adults",
          tone: book.tone as "educational" | "funny" | "inspirational" | "professional" | "casual",
          numEntries: book.numEntries,
          minWords: book.minWords,
          maxWords: book.maxWords,
          title: values.title ?? "",
          authorName: values.authorName ?? "",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          toast({ title: "Saved" });
        },
        onError: () => {
          toast({ title: "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  const handleSuggest = () => {
    setTitleSuggestions([]);
    if (!book) return;
    const values = form.getValues();
    updateBook.mutate(
      {
        id: bookId,
        data: {
          niche: book.niche,
          subNiche: book.subNiche,
          deepNiche: book.deepNiche ?? "",
          audience: book.audience as "children" | "teenagers" | "adults",
          tone: book.tone as "educational" | "funny" | "inspirational" | "professional" | "casual",
          numEntries: book.numEntries,
          minWords: book.minWords,
          maxWords: book.maxWords,
          title: values.title ?? "",
          authorName: values.authorName ?? "",
        },
      },
      {
        onSuccess: () => {
          suggestTitles.mutate(
            { id: bookId },
            {
              onSuccess: (data) => {
                const suggestions =
                  (data as { suggestions?: typeof titleSuggestions }).suggestions ?? [];
                setTitleSuggestions(suggestions);
              },
              onError: () => {
                toast({ title: "Title suggestion failed", variant: "destructive" });
              },
            }
          );
        },
        onError: () => {
          toast({ title: "Failed to save before suggesting", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load book</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="w-52 flex-shrink-0 border-r border-border p-4">
        <BookStepNav bookId={bookId} current="structure" bookStatus={book.status} />
      </aside>

      <div className="flex-1 overflow-auto p-8 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Layers className="w-4 h-4" />
              Step 4 — Structure
            </div>
            <h1 className="text-2xl font-semibold">Book Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Name your book and author. Use AI to generate a title based on your niche and settings.
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5 space-y-3 mb-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">Book summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <div><span className="text-xs text-muted-foreground/70">Niche</span><p className="font-medium text-foreground">{book.niche}</p></div>
              <div><span className="text-xs text-muted-foreground/70">Sub-Niche</span><p className="font-medium text-foreground">{book.subNiche}</p></div>
              {book.deepNiche && <div className="col-span-2"><span className="text-xs text-muted-foreground/70">Deep Niche</span><p className="font-medium text-foreground">{book.deepNiche}</p></div>}
              <div><span className="text-xs text-muted-foreground/70">Audience</span><p className="font-medium text-foreground capitalize">{book.audience}</p></div>
              <div><span className="text-xs text-muted-foreground/70">Tone</span><p className="font-medium text-foreground capitalize">{book.tone}</p></div>
              <div><span className="text-xs text-muted-foreground/70">Entries</span><p className="font-medium text-foreground">{book.numEntries}</p></div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
              <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-foreground">Title & Author</h2>
                  <button
                    type="button"
                    disabled={suggestTitles.isPending || updateBook.isPending}
                    onClick={handleSuggest}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {suggestTitles.isPending || updateBook.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {suggestTitles.isPending
                      ? "Suggesting…"
                      : updateBook.isPending
                      ? "Saving…"
                      : "Suggest with AI"}
                  </button>
                </div>

                {titleSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Click a suggestion to use it</p>
                    {titleSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          form.setValue("title", s.fullTitle);
                          setTitleSuggestions([]);
                        }}
                        className="w-full text-left bg-muted/60 hover:bg-accent hover:text-accent-foreground border border-border rounded-lg p-3 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{s.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.subtitle}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1 italic">{s.rationale}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent-foreground flex-shrink-0 mt-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 100 Amazing Ocean Facts" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Author Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={updateBook.isPending}
                  className="flex-1"
                >
                  {updateBook.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>

                <Button
                  type="button"
                  onClick={() => setLocation(`/books/${bookId}/blueprint`)}
                  className="flex-1"
                >
                  Continue to Blueprint
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </Form>
        </motion.div>
      </div>
    </div>
  );
}
