import type { Book } from "@workspace/db";

const RAINFOREST_BASE = "https://api.rainforestapi.com/request";

interface RainforestResult {
  position?: number;
  type?: string;
  title?: string;
  asin?: string;
  link?: string;
  image?: string;
  rating?: number;
  ratings_total?: number;
  is_sponsored?: boolean;
  authors?: Array<{ name: string; link?: string }>;
  subtitle?: string;
  editorial_review?: string;
  badges?: { sponsored?: boolean };
}

interface RainforestResponse {
  search_results?: RainforestResult[];
  request_info?: { success?: boolean };
}

export interface AmazonBookSuggestion {
  title: string;
  author: string;
  reason: string;
  rating?: number;
  reviewCount?: number;
  asin?: string;
  amazonUrl?: string;
  image?: string;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*:.*$/, "")          // remove subtitle after colon
    .replace(/\s*\(.*?\)\s*$/, "")   // remove trailing parentheticals
    .replace(/\s+by\s+.+$/i, "")     // remove "by Author" suffix
    .trim();
}

function extractAuthor(result: RainforestResult): string {
  if (result.authors && result.authors.length > 0) {
    return result.authors.map((a) => a.name).join(", ");
  }
  const byMatch = result.title?.match(/\bby\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*)/);
  if (byMatch) return byMatch[1];
  return "Unknown Author";
}

function buildReason(result: RainforestResult, niche: string): string {
  const parts: string[] = [];
  if (result.rating) parts.push(`★ ${result.rating}`);
  if (result.ratings_total) parts.push(`${result.ratings_total.toLocaleString()} reviews`);
  parts.push(`top seller in ${niche}`);
  return parts.join(" · ");
}

export async function searchAmazonBooksForCompetitors(
  book: Book
): Promise<AmazonBookSuggestion[]> {
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) throw new Error("RAINFOREST_API_KEY is not configured");

  const queries = [
    `${book.deepNiche} ${book.subNiche}`,
    `${book.niche} ${book.subNiche} books bestseller`,
  ];

  const seen = new Set<string>();
  const results: AmazonBookSuggestion[] = [];

  for (const query of queries) {
    if (results.length >= 12) break;

    const params = new URLSearchParams({
      api_key: apiKey,
      type: "search",
      search_term: query,
      amazon_domain: "amazon.com",
      category_id: "283155",
    });

    let data: RainforestResponse;
    try {
      const resp = await fetch(`${RAINFOREST_BASE}?${params}`);
      if (!resp.ok) throw new Error(`Rainforest returned ${resp.status}`);
      data = (await resp.json()) as RainforestResponse;
    } catch (err) {
      console.error("Rainforest search error:", err);
      continue;
    }

    const items = (data.search_results ?? []).filter(
      (r) =>
        r.title &&
        r.asin &&
        !r.is_sponsored &&
        r.type !== "also_viewed" &&
        r.type !== "editorial_recommendation"
    );

    for (const item of items) {
      const asin = item.asin!;
      if (seen.has(asin)) continue;
      seen.add(asin);

      const title = cleanTitle(item.title!);
      if (!title || title.length < 3) continue;

      results.push({
        title,
        author: extractAuthor(item),
        reason: buildReason(item, book.niche),
        rating: item.rating,
        reviewCount: item.ratings_total,
        asin,
        amazonUrl: item.link ?? `https://www.amazon.com/dp/${asin}`,
        image: item.image,
      });

      if (results.length >= 12) break;
    }
  }

  return results.slice(0, 12);
}
