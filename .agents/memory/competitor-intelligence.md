---
name: Competitor Intelligence
description: Competitor analysis sub-system embedded in the Analysis step — architecture, data model, endpoints, and AI functions.
---

## Rule
Competitor Intelligence lives inside the Analysis page. It does NOT add a new step — it's a section within Step 1 (Analysis).

**Why:** User wanted to improve blueprint/write quality by grounding generation in real market intelligence from top competitor books.

## Data Model
Stored as `competitorData TEXT` column on `books` table (JSON-stringified `CompetitorData`):

```typescript
interface CompetitorData {
  competitors: CompetitorBook[];      // each competitor's full analysis
  winningPatterns?: string[];         // cross-competitor synthesis
  marketGaps?: string[];              // underserved topics/angles
  bookAdvantageStrategy?: string;     // differentiation paragraph
  synthesized?: boolean;              // true after synthesis run
}
```

## API Routes (competitors.ts)
- `POST /books/:id/competitors/suggest` → `{ suggestions: CompetitorSuggestion[] }` (no DB write)
- `POST /books/:id/competitors/add` → AI analyzes competitor in-flight, saves to `competitorData`, returns Book
- `DELETE /books/:id/competitors/:competitorId` → removes by id, returns Book
- `POST /books/:id/competitors/analyze` → synthesizes across all analyzed competitors, returns Book

## AI Functions (bookAI.ts)
- `suggestCompetitors(book, cerebras)` → 6 suggestions (title, author, reason) — AI-only, no DB
- `analyzeCompetitorBook(book, competitor, cerebras)` → full analysis (scores, themes, readerLikes/Dislikes, etc.)
- `synthesizeCompetitorIntelligence(book, competitors, cerebras)` → winningPatterns + marketGaps + bookAdvantageStrategy

## Blueprint / Write Integration
Both `generateBlueprint()` and `buildContentPrompt()` now accept optional `CompetitorData` as 5th argument.
Blueprint uses: marketGaps, positiveSignals (to emulate), negativeSignals (to avoid), winningPatterns.
Write uses: winningPatterns, marketGaps, allLikes, allDislikes.

## How to Apply
- When adding features that affect generated content quality, check whether competitor signals should be incorporated
- `competitors.ts` route always reads competitorData from DB at the start of each handler (not cached)
- The `analyzed` flag on each CompetitorBook indicates AI analysis has run
- Old books without `competitorData` show "No analysis yet" in the Analysis page with a "Run Analysis" button
