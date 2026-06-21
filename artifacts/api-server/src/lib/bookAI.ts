import Cerebras from "@cerebras/cerebras_cloud_sdk";
import Groq from "groq-sdk";
import type { Book } from "@workspace/db";
import { CEREBRAS_MODEL } from "./cerebras";
import { GROQ_MODEL } from "./groq";

export interface AudienceAnalysis {
  goals: string[];
  painPoints: string[];
  desires: string[];
  knowledgeLevel: string;
  motivations: string[];
}

export interface GapAnalysis {
  commonIdeas: string[];
  uniquePerspectives: string[];
  freshApproaches: string[];
}

export interface Recommendations {
  idealEntryCount: number;
  idealWordsPerEntry: string;
  breadth: string;
  complexity: string;
}

export interface AnalysisData {
  audienceAnalysis: AudienceAnalysis;
  coreThemes: string[];
  subtopics: string[];
  angles: string[];
  gapAnalysis: GapAnalysis;
  recommendations: Recommendations;
}

export interface ExpertInsight {
  name: string;
  concepts: string[];
}

export interface ContentPillar {
  number: number;
  title: string;
  description: string;
}

export interface ResourceData {
  keyConcepts: string[];
  expertInsights: ExpertInsight[];
  frameworks: string[];
  statisticsAreas: string[];
  storyOpportunities: string[];
  quoteThemes: string[];
  contentPillars: ContentPillar[];
  lockedSections: string[];
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function detectDuplicates(titles: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of titles) {
    const key = t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  return unique;
}

function audienceDesc(audience: string): string {
  return audience === "children"
    ? "children aged 4-10 (simple language)"
    : audience === "teenagers"
    ? "teenagers aged 11-16 (moderate vocabulary)"
    : "adults aged 17-50 (full vocabulary)";
}

export async function generateAnalysis(book: Book, cerebras: Cerebras): Promise<AnalysisData> {
  const prompt = `You are a professional book publishing analyst. Analyze this book topic deeply.

Book Details:
- Niche: ${book.niche}
- Sub-Niche: ${book.subNiche}
- Deep Niche: ${book.deepNiche}
- Audience: ${audienceDesc(book.audience)}
- Tone: ${book.tone}
- Number of Entries: ${book.numEntries}
- Words Per Entry: ${book.minWords}–${book.maxWords}

Generate a comprehensive topic analysis. Return ONLY valid JSON matching this exact structure:

{
  "audienceAnalysis": {
    "goals": ["goal1", "goal2", "goal3", "goal4", "goal5"],
    "painPoints": ["pain1", "pain2", "pain3", "pain4", "pain5"],
    "desires": ["desire1", "desire2", "desire3", "desire4"],
    "knowledgeLevel": "beginner/intermediate/advanced description",
    "motivations": ["motivation1", "motivation2", "motivation3", "motivation4"]
  },
  "coreThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5", "Theme 6", "Theme 7", "Theme 8", "Theme 9", "Theme 10"],
  "subtopics": ["subtopic 1", "subtopic 2", "subtopic 3", "subtopic 4", "subtopic 5", "subtopic 6", "subtopic 7", "subtopic 8", "subtopic 9", "subtopic 10", "subtopic 11", "subtopic 12", "subtopic 13", "subtopic 14", "subtopic 15", "subtopic 16", "subtopic 17", "subtopic 18", "subtopic 19", "subtopic 20"],
  "angles": ["angle 1", "angle 2", "angle 3", "angle 4", "angle 5", "angle 6", "angle 7"],
  "gapAnalysis": {
    "commonIdeas": ["common idea 1", "common idea 2", "common idea 3", "common idea 4", "common idea 5"],
    "uniquePerspectives": ["unique 1", "unique 2", "unique 3", "unique 4", "unique 5"],
    "freshApproaches": ["fresh 1", "fresh 2", "fresh 3", "fresh 4", "fresh 5"]
  },
  "recommendations": {
    "idealEntryCount": ${book.numEntries},
    "idealWordsPerEntry": "${book.minWords}–${book.maxWords}",
    "breadth": "description of topic breadth",
    "complexity": "description of topic complexity"
  }
}

Be specific to the exact topic "${book.deepNiche}". Return only valid JSON.`;

  const response = await cerebras.chat.completions.create({
    model: CEREBRAS_MODEL,
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content as string) ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Analysis generation returned invalid JSON");

  return JSON.parse(jsonMatch[0]) as AnalysisData;
}

export async function generateResources(
  book: Book,
  analysis: AnalysisData,
  cerebras: Cerebras,
  lockedSections: string[] = []
): Promise<ResourceData> {
  const prompt = `You are a professional research librarian and book content strategist. Build a research resource library for this book.

Book Details:
- Topic: ${book.deepNiche}
- Niche: ${book.niche}
- Audience: ${audienceDesc(book.audience)}
- Tone: ${book.tone}
- Core Themes: ${analysis.coreThemes.slice(0, 6).join(", ")}
- Key Angles: ${analysis.angles.slice(0, 4).join(", ")}
- Unique Perspectives: ${analysis.gapAnalysis.uniquePerspectives.join(", ")}

Generate a comprehensive research resource library. Return ONLY valid JSON matching this exact structure:

{
  "keyConcepts": ["concept 1", "concept 2", "concept 3", "concept 4", "concept 5", "concept 6", "concept 7", "concept 8"],
  "expertInsights": [
    { "name": "Expert Name 1", "concepts": ["concept a", "concept b"] },
    { "name": "Expert Name 2", "concepts": ["concept c", "concept d"] },
    { "name": "Expert Name 3", "concepts": ["concept e", "concept f"] },
    { "name": "Expert Name 4", "concepts": ["concept g", "concept h"] },
    { "name": "Expert Name 5", "concepts": ["concept i", "concept j"] }
  ],
  "frameworks": ["Framework 1", "Framework 2", "Framework 3", "Framework 4", "Framework 5", "Framework 6"],
  "statisticsAreas": ["research area 1", "research area 2", "research area 3", "research area 4", "research area 5"],
  "storyOpportunities": ["story type 1", "story type 2", "story type 3", "story type 4", "story type 5", "story type 6"],
  "quoteThemes": ["theme 1", "theme 2", "theme 3", "theme 4", "theme 5", "theme 6", "theme 7"],
  "contentPillars": [
    { "number": 1, "title": "Pillar 1 Title", "description": "Brief description of what this pillar covers" },
    { "number": 2, "title": "Pillar 2 Title", "description": "Brief description of what this pillar covers" },
    { "number": 3, "title": "Pillar 3 Title", "description": "Brief description of what this pillar covers" },
    { "number": 4, "title": "Pillar 4 Title", "description": "Brief description of what this pillar covers" },
    { "number": 5, "title": "Pillar 5 Title", "description": "Brief description of what this pillar covers" },
    { "number": 6, "title": "Pillar 6 Title", "description": "Brief description of what this pillar covers" }
  ],
  "lockedSections": []
}

Be specific to the exact topic "${book.deepNiche}". Return only valid JSON.`;

  const response = await cerebras.chat.completions.create({
    model: CEREBRAS_MODEL,
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content as string) ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resource generation returned invalid JSON");

  const result = JSON.parse(jsonMatch[0]) as ResourceData;
  result.lockedSections = lockedSections;
  return result;
}

export async function generateBlueprint(
  book: Book,
  cerebras: Cerebras,
  analysis?: AnalysisData | null,
  resources?: ResourceData | null
): Promise<string[]> {
  const pillarsSection = resources?.contentPillars?.length
    ? `\nContent Pillars to cover:\n${resources.contentPillars.map((p) => `- Pillar ${p.number}: ${p.title} — ${p.description}`).join("\n")}`
    : "";

  const anglesSection = analysis?.angles?.length
    ? `\nContent angles to vary across entries: ${analysis.angles.join(", ")}`
    : "";

  const uniqueSection = analysis?.gapAnalysis?.uniquePerspectives?.length
    ? `\nPrioritize these fresh perspectives (underused in the market): ${analysis.gapAnalysis.uniquePerspectives.join(", ")}`
    : "";

  const subtopicsSection = analysis?.subtopics?.length
    ? `\nSubtopics to draw from: ${analysis.subtopics.slice(0, 30).join(", ")}`
    : "";

  const frameworksSection = resources?.frameworks?.length
    ? `\nRelevant frameworks and models: ${resources.frameworks.join(", ")}`
    : "";

  const prompt = `You are generating a blueprint for a ${book.tone} ${book.niche} book.
Niche: ${book.niche}
Sub-Niche: ${book.subNiche}
Deep Niche: ${book.deepNiche}
Audience: ${audienceDesc(book.audience)}
Tone: ${book.tone}
${pillarsSection}${anglesSection}${uniqueSection}${subtopicsSection}${frameworksSection}

Generate exactly ${book.numEntries} unique, creative, and specific entry titles for this book.

Requirements:
- Every title must be distinct — no two entries can cover the same concept
- Vary the angle and approach: mix beginner-friendly, advanced, practical, science-backed, story-driven, myth-busting, and motivational entries
- Titles must be curiosity-driven, highly specific, and audience-focused
- Distribute entries across all content pillars evenly
- Ensure logical progression across the book
- Each title must feel like it adds something unique the reader hasn't seen before

Output ONLY the numbered list of titles, one per line, like:
1. Title One
2. Title Two
...

Do not include any other text, explanation, or formatting.`;

  const response = await cerebras.chat.completions.create({
    model: CEREBRAS_MODEL,
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content as string) ?? "";
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
    .filter((l) => l.length > 0);

  return detectDuplicates(lines).slice(0, book.numEntries);
}

export async function regenerateSingleTitle(
  book: Book,
  position: number,
  existingTitles: string[],
  groq: Groq
): Promise<string> {
  const otherTitles = existingTitles.filter((_, i) => i !== position - 1);

  const prompt = `Generate a single creative title for entry #${position} in a ${book.tone} ${book.niche} book about "${book.deepNiche}" for ${audienceDesc(book.audience)}.

These titles are already taken — yours must be different from all of them:
${otherTitles.map((t) => `- ${t}`).join("\n")}

Reply with ONLY the new title. No number, no explanation, no punctuation before or after.`;

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 80,
    messages: [
      { role: "system", content: "You output only a single book entry title. Nothing else — no explanations, no numbers, no quotes." },
      { role: "user", content: prompt },
    ],
  });

  const raw = (response.choices[0]?.message?.content as string) ?? "";

  const title = raw
    .split("\n")
    .map((l) =>
      l
        .replace(/^\d+[\.\)]\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/^["']|["']$/g, "")
        .trim()
    )
    .find((l) => l.length > 5) ?? "";

  if (!title) {
    throw new Error("AI returned an empty title. Please try again.");
  }

  return title;
}

export function buildContentPrompt(
  book: Book,
  entryTitle: string,
  analysis?: AnalysisData | null,
  resources?: ResourceData | null
): string {
  const audience =
    book.audience === "children"
      ? "children aged 4-10 (simple language only)"
      : book.audience === "teenagers"
      ? "teenagers aged 11-16"
      : "adults";

  const tone =
    {
      educational: "educational and informative",
      funny: "funny and entertaining",
      inspirational: "inspirational",
      professional: "professional",
      casual: "casual and friendly",
    }[book.tone] ?? "engaging";

  const min = book.minWords;
  const max = book.maxWords;
  const niche = book.niche.toLowerCase();

  const sectionSentences = Math.max(3, Math.ceil(min / 15));

  let sectionInstructions: string;

  if (niche.includes("fact")) {
    sectionInstructions = `
SECTION 1 – MAIN FACT
Write ${sectionSentences} or more complete sentences about this topic. Include specific numbers, measurements, scientific details, and real-world comparisons. Paint a vivid picture — explain not just what the fact is but why it is remarkable.

SECTION 2 – DID YOU KNOW?
Write ${Math.max(2, Math.ceil(min / 25))} or more complete sentences revealing a surprising related detail. This must add genuinely new information — not repeat the first section.`;
  } else if (niche.includes("trivia")) {
    sectionInstructions = `
QUESTION: Write the trivia question.
A) Option one
B) Option two
C) Option three
D) Option four
ANSWER: State the correct letter and the full answer.
EXPLANATION: Write ${sectionSentences} or more complete sentences explaining why the answer is correct, including background history, science, or interesting context.`;
  } else if (niche.includes("joke")) {
    sectionInstructions = `
SETUP: Write 3 or more complete sentences establishing the joke scenario with enough context and detail for the punchline to land.
PUNCHLINE: Deliver the punchline.
WHY IT'S FUNNY: Write 2 or more sentences unpacking the wordplay or humour.`;
  } else if (niche.includes("riddle")) {
    sectionInstructions = `
RIDDLE: Write the riddle with enough clues spread across 3 or more sentences.
HINT: Write 2 sentences offering a subtle nudge.
ANSWER: State the answer. Then write 2 or more sentences explaining the reasoning behind it.`;
  } else if (niche.includes("productiv") || niche.includes("tip")) {
    sectionInstructions = `
TIP: ${entryTitle}
WHY IT WORKS: Write ${sectionSentences} or more complete sentences explaining the psychology, science, or reasoning. Be specific — reference real mechanisms, not vague statements.
ACTION STEP: Write ${Math.max(2, Math.ceil(min / 25))} or more complete sentences describing exactly what to do, when, and how to make it a daily habit.`;
  } else if (niche.includes("lesson") || niche.includes("principle")) {
    sectionInstructions = `
LESSON: ${entryTitle}
EXPLANATION: Write ${sectionSentences} or more complete sentences explaining what this lesson means and why it matters. Use a concrete real-world scenario.
HOW TO APPLY IT: Write ${Math.max(2, Math.ceil(min / 25))} or more complete sentences with a practical step-by-step example a real person can follow today.`;
  } else if (niche.includes("story prompt") || niche.includes("writing prompt")) {
    sectionInstructions = `
SCENE: Write ${sectionSentences} or more complete sentences setting up the story — introduce the setting, a character, and a source of tension or conflict.
THE CHALLENGE: Write ${Math.max(2, Math.ceil(min / 25))} or more sentences adding a creative twist or unexpected constraint.`;
  } else {
    sectionInstructions = `Write ${sectionSentences} or more complete, detailed sentences about this topic. Include specific examples, numbers, and context. Never write a one-liner.`;
  }

  const contextSection = buildContextSection(analysis, resources);

  return `You are writing an entry for a ${tone} ${book.niche} book called "${book.deepNiche}", targeted at ${audience}.

Entry title: "${entryTitle}"
${sectionInstructions}
${contextSection}
Your response must be between ${min} and ${max} words. Write every sentence in full. Do not use bullet points. Do not write the title again at the top. Do not include any word count or commentary.`;
}

function buildContextSection(
  analysis?: AnalysisData | null,
  resources?: ResourceData | null
): string {
  const parts: string[] = [];

  if (resources?.contentPillars?.length) {
    parts.push(`Relevant content pillars: ${resources.contentPillars.map((p) => p.title).join(", ")}`);
  }
  if (resources?.keyConcepts?.length) {
    parts.push(`Key concepts to potentially reference: ${resources.keyConcepts.slice(0, 6).join(", ")}`);
  }
  if (resources?.frameworks?.length) {
    parts.push(`Frameworks/models to draw on if relevant: ${resources.frameworks.slice(0, 4).join(", ")}`);
  }
  if (analysis?.angles?.length) {
    parts.push(`Content angles to consider: ${analysis.angles.slice(0, 4).join(", ")}`);
  }
  if (resources?.storyOpportunities?.length) {
    parts.push(`Story/example types that work well: ${resources.storyOpportunities.slice(0, 3).join(", ")}`);
  }

  if (parts.length === 0) return "";

  return `\nResearch context (use where relevant — do not force all of it):\n${parts.map((p) => `- ${p}`).join("\n")}\n`;
}

export function buildContentSystemPrompt(minWords: number, maxWords: number): string {
  return `You are a professional nonfiction book writer. You write rich, detailed, fully-developed content — never brief summaries. Every response must be between ${minWords} and ${maxWords} words. If a section feels short, keep writing until you hit the word target.`;
}
