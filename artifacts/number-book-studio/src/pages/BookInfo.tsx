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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Info, ArrowRight, Save, Loader2, AlertCircle, Sparkles, ChevronRight } from "lucide-react";

const schema = z.object({
  niche: z.string().min(1, "Required"),
  subNiche: z.string().min(1, "Required"),
  deepNiche: z.string().optional().default(""),
  audience: z.enum(["children", "teenagers", "adults"]),
  tone: z.enum(["educational", "funny", "inspirational", "professional", "casual"]),
  numEntries: z.coerce.number().min(10).max(1000),
  minWords: z.coerce.number().min(10).max(500),
  maxWords: z.coerce.number().min(10).max(1000),
  title: z.string().optional().default(""),
  authorName: z.string().optional().default(""),
});

type FormValues = z.infer<typeof schema>;

const ENTRY_COUNT_OPTIONS = [50, 100, 250, 500, 1000];

export default function BookInfo() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: book, isLoading, isError } = useGetBook(bookId);
  const updateBook = useUpdateBook();
  const suggestTitles = useSuggestTitles();
  const [titleSuggestions, setTitleSuggestions] = useState<Array<{ title: string; subtitle: string; fullTitle: string; rationale: string }>>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      niche: "",
      subNiche: "",
      deepNiche: "",
      audience: "adults",
      tone: "educational",
      numEntries: 100,
      minWords: 50,
      maxWords: 100,
      title: "",
      authorName: "",
    },
  });

  useEffect(() => {
    if (book) {
      form.reset({
        niche: book.niche,
        subNiche: book.subNiche,
        deepNiche: book.deepNiche ?? "",
        audience: book.audience as FormValues["audience"],
        tone: book.tone as FormValues["tone"],
        numEntries: book.numEntries,
        minWords: book.minWords,
        maxWords: book.maxWords,
        title: book.title ?? "",
        authorName: book.authorName ?? "",
      });
    }
  }, [book]);

  const onSave = (values: FormValues) => {
    updateBook.mutate(
      { id: bookId, data: { ...values, deepNiche: values.deepNiche ?? "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
          toast({ title: "Book info saved" });
        },
        onError: () => {
          toast({ title: "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  const onContinue = () => {
    setLocation(`/books/${bookId}/analysis`);
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
        <BookStepNav bookId={bookId} current="info" bookStatus={book.status} />
      </aside>

      <div className="flex-1 overflow-auto p-8 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Info className="w-4 h-4" />
              Step 1 — Book Info
            </div>
            <h1 className="text-2xl font-semibold">Book Configuration</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review and update your book's niche, audience, and writing parameters.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
              <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
                <h2 className="font-medium text-sm text-foreground">Topic Hierarchy</h2>

                <FormField
                  control={form.control}
                  name="niche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niche</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Health" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subNiche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-Niche</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Weight Loss" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deepNiche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Deep Niche{" "}
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium ml-1">
                          Optional
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Keto for Women Over 40" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 grid grid-cols-2 gap-4">
                <h2 className="col-span-2 font-medium text-sm text-foreground">Audience & Tone</h2>

                <FormField
                  control={form.control}
                  name="audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audience</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="children">Children (4-10)</SelectItem>
                          <SelectItem value="teenagers">Teenagers (11-16)</SelectItem>
                          <SelectItem value="adults">Adults (17-50)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="educational">Educational</SelectItem>
                          <SelectItem value="funny">Funny</SelectItem>
                          <SelectItem value="inspirational">Inspirational</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
                <h2 className="font-medium text-sm text-foreground">Volume & Length</h2>

                <FormField
                  control={form.control}
                  name="numEntries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Entries</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input type="number" min={10} max={1000} {...field} />
                          <div className="flex gap-1.5">
                            {ENTRY_COUNT_OPTIONS.map((n) => (
                              <button
                                type="button"
                                key={n}
                                onClick={() => form.setValue("numEntries", n)}
                                className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minWords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Words per Entry</FormLabel>
                        <FormControl>
                          <Input type="number" min={10} max={500} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxWords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Words per Entry</FormLabel>
                        <FormControl>
                          <Input type="number" min={10} max={1000} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-foreground">Book Details (optional)</h2>
                  <button
                    type="button"
                    disabled={suggestTitles.isPending || updateBook.isPending}
                    onClick={() => {
                      setTitleSuggestions([]);
                      const values = form.getValues();
                      updateBook.mutate(
                        { id: bookId, data: { ...values, deepNiche: values.deepNiche ?? "" } },
                        {
                          onSuccess: () => {
                            suggestTitles.mutate(
                              { id: bookId },
                              {
                                onSuccess: (data) => {
                                  const suggestions = (data as { suggestions?: typeof titleSuggestions }).suggestions ?? [];
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
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {(suggestTitles.isPending || updateBook.isPending) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {suggestTitles.isPending ? "Suggesting…" : updateBook.isPending ? "Saving…" : "Suggest with AI"}
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
                  Save Changes
                </Button>

                <Button
                  type="button"
                  onClick={onContinue}
                  className="flex-1"
                >
                  Continue to Analysis
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
