import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, BookOpen } from "lucide-react";

const schema = z.object({
  niche: z.string().min(1, "Required"),
  subNiche: z.string().min(1, "Required"),
  deepNiche: z.string().min(1, "Required"),
  audience: z.enum(["children", "teenagers", "adults"]),
  tone: z.enum(["educational", "funny", "inspirational", "professional", "casual"]),
  numEntries: z.coerce.number().min(10).max(1000),
  minWords: z.coerce.number().min(10).max(500),
  maxWords: z.coerce.number().min(10).max(1000),
  title: z.string().optional(),
  authorName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NICHE_SUGGESTIONS = [
  "Fun Facts", "Trivia", "Jokes", "Riddles", "Productivity Tips",
  "Success Principles", "Life Lessons", "Story Prompts", "Writing Prompts",
];

const ENTRY_COUNT_OPTIONS = [50, 100, 250, 500, 1000];

export default function NewBook() {
  const [, setLocation] = useLocation();
  const createBook = useCreateBook();
  const { toast } = useToast();

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

  const onSubmit = (values: FormValues) => {
    createBook.mutate(
      { data: values },
      {
        onSuccess: (book) => {
          setLocation(`/books/${book.id}/analysis`);
        },
        onError: () => {
          toast({ title: "Failed to create book", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <BookOpen className="w-4 h-4" />
            Step 1 of 4 — Research
          </div>
          <h1 className="text-2xl font-semibold">Configure Your Book</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define the niche and parameters. The AI will generate a blueprint of entry titles.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Niche group */}
            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <h2 className="font-medium text-sm text-foreground">Topic Hierarchy</h2>

              <FormField
                control={form.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niche</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input placeholder="e.g. Fun Facts" {...field} data-testid="input-niche" />
                        <div className="flex flex-wrap gap-1.5">
                          {NICHE_SUGGESTIONS.map((s) => (
                            <button
                              type="button"
                              key={s}
                              onClick={() => form.setValue("niche", s)}
                              className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
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
                      <Input placeholder="e.g. Animal Facts" {...field} data-testid="input-sub-niche" />
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
                    <FormLabel>Deep Niche</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Ocean Animal Facts" {...field} data-testid="input-deep-niche" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Audience & Tone */}
            <div className="bg-card border border-card-border rounded-xl p-5 grid grid-cols-2 gap-4">
              <h2 className="col-span-2 font-medium text-sm text-foreground">Audience & Tone</h2>
              <FormField
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-audience">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tone">
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

            {/* Entries & Word Count */}
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
                        <Input type="number" min={10} max={1000} {...field} data-testid="input-num-entries" />
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
                        <Input type="number" min={10} max={500} {...field} data-testid="input-min-words" />
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
                        <Input type="number" min={10} max={1000} {...field} data-testid="input-max-words" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Optional metadata */}
            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <h2 className="font-medium text-sm text-foreground">Book Details (optional)</h2>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Book Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 100 Amazing Ocean Facts" {...field} data-testid="input-title" />
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
                      <Input placeholder="e.g. Jane Smith" {...field} data-testid="input-author" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createBook.isPending}
              data-testid="button-generate-blueprint"
            >
              {createBook.isPending ? "Creating..." : "Generate Blueprint"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
