---
name: Analysis & Resources steps
description: Two new pre-Blueprint steps added to the workflow — status flow, DB columns, and AI function signatures.
---

## Rule
The workflow has 6 steps: Analysis → Resources → Blueprint → Write → Quality → Export.

**Why:** Added to improve blueprint and entry quality by grounding generation in structured topic intelligence and a research library.

## Status Flow
`setup` → `analysis` → `resources` → `blueprint` → `writing` → `quality` → `finished`

## DB Columns Added
- `books.analysis_data TEXT` — JSON-stringified `AnalysisData`
- `books.resource_data TEXT` — JSON-stringified `ResourceData`

## AI Function Signatures (bookAI.ts)
- `generateAnalysis(book, cerebras)` → `AnalysisData`
- `generateResources(book, analysis, cerebras, lockedSections[])` → `ResourceData`
- `generateBlueprint(book, cerebras, analysis?, resources?)` — analysis + resources are optional enrichment
- `buildContentPrompt(book, entryTitle, analysis?, resources?)` — same optional enrichment

## How to Apply
- Blueprint generation reads `book.analysisData` and `book.resourceData` from DB before calling `generateBlueprint`
- Entry generation reads the same data before calling `buildContentPrompt`
- Locked sections in Resources are preserved on partial regeneration via `lockedSections` array in the request body
- `BookStepNav` requires `bookStatus` prop to enforce step locking
