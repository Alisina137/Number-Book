import type { Book } from "@workspace/db";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    infoLink?: string;
    canonicalVolumeLink?: string;
    categories?: string[];
    publishedDate?: string;
  };
  saleInfo?: {
    buyLink?: string;
  };
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: GoogleBooksVolume[];
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

function buildAmazonSearchUrl(title: string, author?: string): string {
  const q = [title, author].filter(Boolean).join(" ");
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=stripbooks`;
}

function buildReason(vol: GoogleBooksVolume, niche: string): string {
  const parts: string[] = [];
  if (vol.volumeInfo.averageRating) parts.push(`★ ${vol.volumeInfo.averageRating}`);
  if (vol.volumeInfo.ratingsCount) parts.push(`${vol.volumeInfo.ratingsCount.toLocaleString()} ratings`);
  if (vol.volumeInfo.publishedDate) parts.push(vol.volumeInfo.publishedDate.slice(0, 4));
  parts.push(`in ${niche}`);
  return parts.join(" · ");
}

async function searchGoogleBooks(query: string): Promise<GoogleBooksVolume[]> {
  const params = new URLSearchParams({
    q: query,
    orderBy: "relevance",
    maxResults: "20",
    printType: "books",
    langRestrict: "en",
  });

  const resp = await fetch(`${GOOGLE_BOOKS_BASE}?${params}`);
  if (!resp.ok) throw new Error(`Google Books API error: ${resp.status}`);

  const data = (await resp.json()) as GoogleBooksResponse;
  return data.items ?? [];
}

export async function searchAmazonBooksForCompetitors(
  book: Book
): Promise<AmazonBookSuggestion[]> {
  const queries = [
    `${book.deepNiche || book.subNiche} ${book.niche}`,
    `${book.subNiche} ${book.niche} guide`,
  ];

  const seen = new Set<string>();
  const results: AmazonBookSuggestion[] = [];

  for (const query of queries) {
    if (results.length >= 12) break;

    let items: GoogleBooksVolume[];
    try {
      items = await searchGoogleBooks(query);
    } catch (err) {
      console.error("Google Books search error:", err);
      continue;
    }

    for (const item of items) {
      if (results.length >= 12) break;

      const v = item.volumeInfo;
      if (!v.title) continue;

      const key = v.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);

      const author = (v.authors ?? []).slice(0, 2).join(", ") || "Unknown Author";
      const thumbnail = v.imageLinks?.thumbnail
        ?? v.imageLinks?.smallThumbnail;

      results.push({
        title: v.title,
        author,
        reason: buildReason(item, book.niche),
        rating: v.averageRating,
        reviewCount: v.ratingsCount,
        amazonUrl: buildAmazonSearchUrl(v.title, v.authors?.[0]),
        image: thumbnail,
      });
    }
  }

  return results.slice(0, 12);
}
