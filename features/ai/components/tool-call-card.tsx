"use client";

import { useState } from "react";
import {
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { WebSearchOutput } from "@/features/ai/tools/web-search";

type ToolPart = Extract<
  UIMessage["parts"][number],
  { type: string; toolCallId?: string; state?: string }
>;

function isWebSearchOutput(value: unknown): value is WebSearchOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "results" in value &&
    Array.isArray((value as WebSearchOutput).results)
  );
}

type ToolCallCardProps = {
  part: ToolPart;
};

/**
 * Renders a single tool invocation with loading, result, and error states.
 */
export function ToolCallCard({ part }: ToolCallCardProps) {
  if (!isToolUIPart(part)) return null;

  const toolName = getToolName(part);
  const isSearch = toolName === "webSearch";
  const label = isSearch ? "Web search" : toolName;

  const query =
    part.state !== "input-streaming" &&
    part.input &&
    typeof part.input === "object" &&
    part.input !== null &&
    "query" in part.input
      ? String((part.input as { query?: string }).query ?? "")
      : part.state === "input-streaming" &&
          part.input &&
          typeof part.input === "object" &&
          part.input !== null &&
          "query" in part.input
        ? String((part.input as { query?: string }).query ?? "")
        : "";

  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";
  const isError = part.state === "output-error";
  const hasOutput = part.state === "output-available";

  const [open, setOpen] = useState(isError || hasOutput);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "w-full max-w-xl overflow-hidden rounded-lg border text-sm",
          isError
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-muted/40"
        )}
      >
        <CollapsibleTrigger
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60"
        >
          {isLoading ? (
            <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : isError ? (
            <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
          ) : (
            <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">
            {isLoading
              ? `Searching the web${query ? `: “${query}”` : "…"}`
              : isError
                ? `${label} failed`
                : query
                  ? `${label}: “${query}”`
                  : label}
          </span>
          <ChevronDownIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-2 border-t px-3 py-2">
            {isLoading ? (
              <p className="text-muted-foreground">Looking up sources…</p>
            ) : null}

            {isError ? (
              <p className="text-destructive">
                {part.errorText || "Something went wrong while searching."}
              </p>
            ) : null}

            {hasOutput && isWebSearchOutput(part.output) ? (
              part.output.results.length === 0 ? (
                <p className="text-muted-foreground">No results found.</p>
              ) : (
                <ul className="space-y-2">
                  {part.output.results.map((result) => (
                    <li key={result.url} className="min-w-0">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {result.title}
                      </a>
                      {result.content ? (
                        <p className="line-clamp-2 text-muted-foreground">
                          {result.content}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
