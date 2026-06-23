import type { Book } from "@workspace/db";

const SCALE_SERP_BASE = "https://api.scaleserp.com/search";
const SCALE_SERP_API_KEY = process.env.SCALE_SERP_API_KEY ?? "";

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

interface ScaleSerpAmazonResult {
  title?: string;
  asin?: string;
  link?: string;
  rating?: number;
  ratings_total?: number;
  image?: string;
  authors?: Array<{ name: string; link?: string }>;
  price?: string;
}

interface ScaleSerpResponse {
  amazon_results?: ScaleSerpAmazonResult[];
  error?: string;
}

async function searchAmazonByTag(tag: string): Promise<ScaleSerpAmazonResult[]> {
  if (!SCALE_SERP_API_KEY) throw new Error("SCALE_SERP_API_KEY is not set");

  const params = new URLSearchParams({
    api_key: SCALE_SERP_API_KEY,
    search_type: "amazon",
    amazon_domain: "amazon.com",
    q: `${tag} book`,
    output: "json",
  });

  const resp = await fetch(`${SCALE_SERP_BASE}?${params}`);
  if (!resp.ok) throw new Error(`Scale SERP API error: ${resp.status}`);

  const data = (await resp.json()) as ScaleSerpResponse;
  if (data.error) throw new Error(`Scale SERP error: ${data.error}`);

  return data.amazon_results ?? [];
}

export async function searchAmazonBooksForCompetitors(
  book: Book,
  tags?: string[]
): Promise<AmazonBookSuggestion[]> {
  const searchTags = tags && tags.length > 0
    ? tags
    : [
        `${book.deepNiche || book.subNiche} ${book.niche}`,
        `${book.subNiche} ${book.niche} guide`,
      ];

  const seen = new Set<string>();
  const results: AmazonBookSuggestion[] = [];

  for (const tag of searchTags) {
    if (results.length >= 12) break;

    let items: ScaleSerpAmazonResult[];
    try {
      items = await searchAmazonByTag(tag);
    } catch (err) {
      console.error(`Scale SERP search error for tag "${tag}":`, err);
      continue;
    }

    for (const item of items) {
      if (results.length >= 12) break;
      if (!item.title) continue;

      const key = item.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);

      const author = item.authors?.map((a) => a.name).slice(0, 2).join(", ") ?? "Unknown Author";
      const reasonParts: string[] = [];
      if (item.rating) reasonParts.push(`★ ${item.rating}`);
      if (item.ratings_total) reasonParts.push(`${item.ratings_total.toLocaleString()} ratings`);
      reasonParts.push(`"${tag}"`);

      results.push({
        title: item.title,
        author,
        reason: reasonParts.join(" · "),
        rating: item.rating,
        reviewCount: item.ratings_total,
        asin: item.asin,
        amazonUrl: item.link ?? (item.asin ? `https://www.amazon.com/dp/${item.asin}` : undefined),
        image: item.image,
      });
    }
  }

  return results.slice(0, 12);
}
