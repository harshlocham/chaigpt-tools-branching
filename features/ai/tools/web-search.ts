import { tool } from "ai";
import { z } from "zod";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

export type WebSearchOutput = {
  query: string;
  results: WebSearchResult[];
};

/**
 * Searches the web via Tavily and returns compact results for the model.
 */
async function searchWithTavily(query: string): Promise<WebSearchOutput> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Add it to your environment to enable web search."
    );
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: false,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Web search failed (${response.status}): ${body || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const results: WebSearchResult[] = (data.results ?? [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title!,
      url: item.url!,
      content: (item.content ?? "").slice(0, 500),
    }));

  return { query, results };
}

/** AI SDK tool — model decides when to invoke for realtime / unknown facts. */
export const webSearch = tool({
  description:
    "Search the web for up-to-date information. Use when the user asks about current events, recent data, or facts you may not know.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("The search query to look up on the web"),
  }),
  execute: async ({ query }): Promise<WebSearchOutput> => {
    return searchWithTavily(query);
  },
});
