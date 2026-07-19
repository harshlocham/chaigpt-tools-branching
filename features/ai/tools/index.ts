import { webSearch } from "./web-search";

/** Tools available to the chat model during streaming completions. */
export const chatTools = {
  webSearch,
};

export type ChatTools = typeof chatTools;
