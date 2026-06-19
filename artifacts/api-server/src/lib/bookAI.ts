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
  const audienceInstructions =
    book.audience === "children"
      ? "Use very simple language, short sentences, and easy concepts suitable for children aged 4-10."
      : book.audience === "teenagers"
      ? "Use moderate vocabulary and moderate complexity suitable for teenagers aged 11-16."
      : "Use full vocabulary and advanced concepts suitable for adults aged 17-50.";

  const toneInstructions =
    {
      educational: "Write in an educational, informative tone that teaches the reader something new.",
      funny: "Write in a funny, humorous tone that entertains the reader.",
      inspirational: "Write in an inspirational, uplifting tone that motivates the reader.",
      professional: "Write in a professional, authoritative tone.",
      casual: "Write in a casual, conversational tone as if talking to a friend.",
    }[book.tone] ?? "Write in an engaging tone.";

  const wordTarget = `Write between ${book.minWords} and ${book.maxWords} words total.`;

  const nicheUpper = book.niche.toLowerCase();
  let templateInstructions = "";

  if (nicheUpper.includes("fact")) {
    templateInstructions = `Format as:
Title: [${entryTitle}]
Fact: [The main fact content]
Did You Know? [An additional surprising detail]`;
  } else if (nicheUpper.includes("trivia")) {
    templateInstructions = `Format as:
Question: [The trivia question]
A) [Option]
B) [Option]
C) [Option]
D) [Option]
Answer: [Correct letter and answer]
Explanation: [Brief explanation]`;
  } else if (nicheUpper.includes("joke")) {
    templateInstructions = `Format as:
Setup: [The joke setup]
Punchline: [The punchline]`;
  } else if (nicheUpper.includes("riddle")) {
    templateInstructions = `Format as:
Riddle: [The riddle]
Answer: [The answer]`;
  } else if (nicheUpper.includes("productiv") || nicheUpper.includes("tip")) {
    templateInstructions = `Format as:
Tip: [The tip title/headline]
Explanation: [Why this tip works]
Action Step: [Exactly what to do]`;
  } else if (nicheUpper.includes("lesson") || nicheUpper.includes("principle")) {
    templateInstructions = `Format as:
Lesson: [The lesson title]
Explanation: [What this lesson means]
Practical Application: [How to apply it in real life]`;
  } else if (nicheUpper.includes("story prompt") || nicheUpper.includes("writing prompt")) {
    templateInstructions = `Format as:
Prompt Title: [${entryTitle}]
Description: [The prompt description]
Creative Challenge: [An additional creative twist or challenge]`;
  } else {
    templateInstructions = `Write an engaging entry about: ${entryTitle}`;
  }

  return `You are writing a ${book.tone} ${book.niche} book about "${book.deepNiche}" for ${book.audience}.
${audienceInstructions}
${toneInstructions}
${wordTarget}

Write an entry for the following title: "${entryTitle}"

${templateInstructions}

Important: Stay strictly within ${book.minWords}-${book.maxWords} words. Do not add any meta-commentary or explanations.`;
}
