import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateBook } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useSuggestDeepNiche } from "@workspace/api-client-react";
import { ArrowRight, BookOpen, Plus, X, ChevronDown, Check, Sparkles, Loader2 } from "lucide-react";

// ─── Niche data ────────────────────────────────────────────────────────────────

const NICHE_DATA: Record<string, string[]> = {
  "Health": [
    "Weight Loss", "Healthy Eating", "Walking & Step Challenges", "Sleep Improvement",
    "Gut Health", "Healthy Aging", "Men's Health", "Women's Health",
    "Diabetes-Friendly Living", "Heart Health",
  ],
  "Productivity & Goal Achievement": [
    "Time Management", "Daily Planning", "Task Prioritization", "Focus & Concentration",
    "Anti-Procrastination", "Goal Setting", "Deep Work", "Habit Building",
    "Productivity for Students", "Productivity for Entrepreneurs",
  ],
  "Small Business & Side Hustles": [
    "Affiliate Marketing", "Etsy Business", "Print-on-Demand", "Freelancing",
    "Blogging", "YouTube Business", "Digital Products", "Consulting",
    "AI Side Hustles", "Local Service Businesses",
  ],
  "Finance": [
    "Budgeting", "Saving Money", "Debt Reduction", "Investing Basics",
    "Personal Finance", "Financial Independence", "Passive Income",
    "Retirement Planning", "Money Mindset", "Wealth Building",
  ],
  "Mindset & Self Discovery": [
    "Confidence", "Self-Esteem", "Emotional Intelligence", "Self-Awareness",
    "Resilience", "Personal Growth", "Purpose Finding", "Decision Making",
    "Critical Thinking", "Overcoming Fear",
  ],
  "Wellness": [
    "Stress Management", "Work-Life Balance", "Mindfulness", "Digital Detox",
    "Self-Care", "Burnout Recovery", "Relaxation Techniques", "Happiness Habits",
    "Energy Management", "Life Simplification",
  ],
  "Story": [
    "Bedtime Stories", "Inspirational Stories", "Moral Stories", "Short Adventure Stories",
    "Historical Stories", "Survival Stories", "Animal Stories", "Mystery Stories",
    "Motivational Stories", "True-Life Stories",
  ],
  "Facts": [
    "Science Facts", "Psychology Facts", "History Facts", "Space Facts",
    "Animal Facts", "Human Body Facts", "Technology Facts", "Geography Facts",
    "Sports Facts", "Military Facts",
  ],
  "Trivia": [
    "General Knowledge Trivia", "History Trivia", "Sports Trivia", "Football Trivia",
    "Movie Trivia", "Music Trivia", "Geography Trivia", "Science Trivia",
    "Bible Trivia", "Kids Trivia",
  ],
  "Relationships": [
    "Marriage", "Dating", "Communication Skills", "Parenting", "Friendship",
    "Conflict Resolution", "Love Languages", "Long Distance Relationships",
    "Family Relationships", "Relationship Habits",
  ],
};

const NICHE_KEYS = Object.keys(NICHE_DATA);

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  niche: z.string().min(1, "Required"),
  subNiche: z.string().min(1, "Required"),
  deepNiche: z.string().optional().default(""),
  audience: z.enum(["children", "teenagers", "adults"]),
  tone: z.enum(["educational", "funny", "inspirational", "professional", "casual"]),
  numEntries: z.coerce.number().min(10).max(1000),
  minWords: z.coerce.number().min(10).max(500),
  maxWords: z.coerce.number().min(10).max(1000),
  title: z.string().optional(),
  authorName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const ENTRY_COUNT_OPTIONS = [50, 100, 250, 500, 1000];

// ─── NicheSelect component ─────────────────────────────────────────────────────

interface NicheSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  onOptionsChange: (opts: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  optional?: boolean;
}

function NicheSelect({
  value,
  onValueChange,
  options,
  onOptionsChange,
  placeholder,
  disabled = false,
  optional = false,
}: NicheSelectProps) {
  const [open, setOpen] = useState(false);
  const [newOption, setNewOption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.includes(trimmed)) {
      setNewOption("");
      return;
    }
    const next = [...options, trimmed];
    onOptionsChange(next);
    onValueChange(trimmed);
    setNewOption("");
    setOpen(false);
  };

  const removeOption = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = options.filter((o) => o !== opt);
    onOptionsChange(next);
    if (value === opt) onValueChange("");
  };

  const selectOption = (opt: string) => {
    onValueChange(opt === value ? "" : opt);
    setOpen(false);
  };

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`w-full flex items-center justify-between border border-input rounded-md px-3 py-2 text-sm bg-background transition-colors hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {value && optional && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearValue}
                onKeyDown={(e) => e.key === "Enter" && clearValue(e as unknown as React.MouseEvent)}
                className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground opacity-60" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px] shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Options list */}
        <div className="max-h-56 overflow-y-auto py-1">
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
              No options yet — add one below
            </p>
          )}
          {options.map((opt) => (
            <div
              key={opt}
              className="group flex items-center gap-1 px-2 mx-1 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => selectOption(opt)}
            >
              <span className="w-4 flex-shrink-0">
                {value === opt && <Check className="w-3 h-3 text-primary" />}
              </span>
              <span className="flex-1 text-sm py-1.5 leading-tight">{opt}</span>
              <button
                type="button"
                onClick={(e) => removeOption(opt, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/15 transition-opacity flex-shrink-0"
                title="Remove option"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new option */}
        <div className="border-t px-2 py-2 flex gap-1.5">
          <input
            ref={inputRef}
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addOption(); }
              e.stopPropagation();
            }}
            placeholder="Add option…"
            className="flex-1 text-xs px-2 py-1.5 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={addOption}
            className="px-2 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NewBook() {
  const [, setLocation] = useLocation();
  const createBook = useCreateBook();
  const { toast } = useToast();

  const [nicheOptions, setNicheOptions] = useState<string[]>(NICHE_KEYS);
  const [subNicheOptions, setSubNicheOptions] = useState<string[]>([]);
  const [deepNicheOptions, setDeepNicheOptions] = useState<string[]>([]);
  const [deepNicheError, setDeepNicheError] = useState<string | null>(null);
  const [deepNicheSuggestions, setDeepNicheSuggestions] = useState<string[]>([]);

  const suggestDeepNiche = useSuggestDeepNiche();

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

  const handleNicheChange = (niche: string, formOnChange: (v: string) => void) => {
    formOnChange(niche);
    form.setValue("subNiche", "");
    form.setValue("deepNiche", "");
    setSubNicheOptions(NICHE_DATA[niche] ?? []);
    setDeepNicheOptions([]);
  };

  const handleSubNicheChange = (sub: string, formOnChange: (v: string) => void) => {
    formOnChange(sub);
    form.setValue("deepNiche", "");
    setDeepNicheOptions([]);
    setDeepNicheError(null);
    setDeepNicheSuggestions([]);
  };

  const handleSuggestDeepNiche = () => {
    const niche = form.getValues("niche");
    const subNiche = form.getValues("subNiche");
    if (!niche || !subNiche) return;
    setDeepNicheError(null);
    setDeepNicheSuggestions([]);
    suggestDeepNiche.mutate(
      { data: { niche, subNiche } },
      {
        onSuccess: (data) => {
          setDeepNicheSuggestions(data.suggestions ?? []);
        },
        onError: () => {
          setDeepNicheError("AI suggestion failed — try again");
        },
      }
    );
  };

  const onSubmit = (values: FormValues) => {
    createBook.mutate(
      { data: { ...values, deepNiche: values.deepNiche ?? "" } },
      {
        onSuccess: (book) => {
          setLocation(`/books/${book.id}/info`);
        },
        onError: () => {
          toast({ title: "Failed to create book", variant: "destructive" });
        },
      }
    );
  };

  const selectedNiche = form.watch("niche");
  const selectedSubNiche = form.watch("subNiche");

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
              <div>
                <h2 className="font-medium text-sm text-foreground">Topic Hierarchy</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select from the list or type in the box to add your own option. Hover an option to remove it.
                </p>
              </div>

              {/* Niche */}
              <FormField
                control={form.control}
                name="niche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niche</FormLabel>
                    <FormControl>
                      <NicheSelect
                        value={field.value}
                        onValueChange={(v) => handleNicheChange(v, field.onChange)}
                        options={nicheOptions}
                        onOptionsChange={setNicheOptions}
                        placeholder="Select a niche…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sub-Niche */}
              <FormField
                control={form.control}
                name="subNiche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Niche</FormLabel>
                    <FormControl>
                      <NicheSelect
                        value={field.value}
                        onValueChange={(v) => handleSubNicheChange(v, field.onChange)}
                        options={subNicheOptions}
                        onOptionsChange={setSubNicheOptions}
                        placeholder={selectedNiche ? "Select a sub-niche…" : "Select a niche first"}
                        disabled={!selectedNiche}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deep Niche (optional) */}
              <FormField
                control={form.control}
                name="deepNiche"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FormLabel>Deep Niche</FormLabel>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">Optional</span>
                      </div>
                      {selectedSubNiche && (
                        <button
                          type="button"
                          onClick={handleSuggestDeepNiche}
                          disabled={suggestDeepNiche.isPending}
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {suggestDeepNiche.isPending ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</>
                          ) : (
                            <><Sparkles className="w-3 h-3" /> Suggest with AI</>
                          )}
                        </button>
                      )}
                    </div>
                    {deepNicheSuggestions.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <p className="text-[11px] text-muted-foreground">Click a suggestion to use it</p>
                        {deepNicheSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              field.onChange(s);
                              setDeepNicheOptions((prev) => prev.includes(s) ? prev : [...prev, s]);
                              setDeepNicheSuggestions([]);
                            }}
                            className="w-full text-left text-sm px-3 py-2 rounded-lg bg-muted/60 hover:bg-accent hover:text-accent-foreground border border-border transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <FormControl>
                      <NicheSelect
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        options={deepNicheOptions}
                        onOptionsChange={setDeepNicheOptions}
                        placeholder={selectedSubNiche ? "Select or add a deep niche…" : "Select a sub-niche first"}
                        disabled={!selectedSubNiche}
                        optional
                      />
                    </FormControl>
                    {deepNicheError && (
                      <p className="text-[11px] text-destructive mt-1">{deepNicheError}</p>
                    )}
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
