import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { Book } from "@workspace/db";
import { CEREBRAS_MODEL } from "./cerebras";

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

export async function generateBlueprint(book: Book, cerebras: Cerebras): Promise<string[]> {
  const audienceDesc =
    book.audience === "children"
      ? "children aged 4-10 (simple language)"
      : book.audience === "teenagers"
      ? "teenagers aged 11-16 (moderate vocabulary)"
      : "adults aged 17-50 (full vocabulary)";

  const prompt = `You are generating a blueprint for a ${book.tone} ${book.niche} book.
Niche: ${book.niche}
Sub-Niche: ${book.subNiche}
Deep Niche: ${book.deepNiche}
Audience: ${audienceDesc}
Tone: ${book.tone}

Generate exactly ${book.numEntries} unique, creative, and specific entry titles for this book. Each title should be distinct and not repeat the same concept. Vary the angle and approach for each title.

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

export function buildContentPrompt(book: Book, entryTitle: string): string {
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

  // Build a section count hint that scales with the word target
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

  return `You are writing an entry for a ${tone} ${book.niche} book called "${book.deepNiche}", targeted at ${audience}.

Entry title: "${entryTitle}"
${sectionInstructions}

Your response must be between ${min} and ${max} words. Write every sentence in full. Do not use bullet points. Do not write the title again at the top. Do not include any word count or commentary.`;
}

export function buildContentSystemPrompt(minWords: number, maxWords: number): string {
  return `You are a professional nonfiction book writer. You write rich, detailed, fully-developed content — never brief summaries. Every response must be between ${minWords} and ${maxWords} words. If a section feels short, keep writing until you hit the word target.`;
}
