"use server";

import { isTextUIPart, type UIMessage } from "ai";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Extracts plain text from an AI SDK `UIMessage` by joining all text parts. */
function getMessageText(message: UIMessage) {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join("");
}

/**
 * Normalizes stored message parts from the database into AI SDK `UIMessage` parts.
 * Falls back to a single text part when no structured parts are stored.
 */
function toUIMessageParts(
  parts: Prisma.JsonValue | null,
  content: string
): UIMessage["parts"] {
  const stored = parts as UIMessage["parts"] | null;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  return [{ type: "text", text: content }];
}

function toUIRole(role: string): UIMessage["role"] {
  if (role === "ASSISTANT") return "assistant";
  if (role === "SYSTEM") return "system";
  return "user";
}

function toDbRole(role: UIMessage["role"]): "ASSISTANT" | "USER" | "SYSTEM" {
  if (role === "assistant") return "ASSISTANT";
  if (role === "system") return "SYSTEM";
  return "USER";
}

/**
 * Resolves the ordered message IDs that make up a branch's conversation path.
 * Shared ancestor messages (up to each fork tip) + messages owned by the branch.
 */
async function resolveBranchMessageIds(
  conversationId: string,
  branchId: string
): Promise<string[]> {
  const branches = await prisma.branch.findMany({
    where: { conversationId },
  });

  const byId = new Map(branches.map((b) => [b.id, b]));
  const branch = byId.get(branchId);
  if (!branch) {
    return [];
  }

  // Walk from active branch up to root, collecting fork tips
  const chain: typeof branches = [];
  let current: (typeof branches)[number] | undefined = branch;
  while (current) {
    chain.unshift(current);
    current = current.parentBranchId
      ? byId.get(current.parentBranchId)
      : undefined;
  }

  const pathIds: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    const isLeaf = i === chain.length - 1;

    if (isLeaf) {
      // All messages owned by the active branch
      const owned = await prisma.message.findMany({
        where: { conversationId, branchId: node.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      for (const msg of owned) {
        if (!seen.has(msg.id)) {
          seen.add(msg.id);
          pathIds.push(msg.id);
        }
      }
    } else {
      // Ancestor: include messages on this branch up to (and including) the child's fork tip
      const child = chain[i + 1];
      const forkTipId = child.forkFromMessageId;
      if (!forkTipId) continue;

      const forkTip = await prisma.message.findUnique({
        where: { id: forkTipId },
        select: { createdAt: true },
      });
      if (!forkTip) continue;

      const shared = await prisma.message.findMany({
        where: {
          conversationId,
          branchId: node.id,
          createdAt: { lte: forkTip.createdAt },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      for (const msg of shared) {
        if (!seen.has(msg.id)) {
          seen.add(msg.id);
          pathIds.push(msg.id);
        }
      }
    }
  }

  return pathIds;
}

/**
 * Ensures a conversation has an active branch, creating Main if needed.
 */
export async function ensureActiveBranch(conversationId: string): Promise<string> {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { activeBranchId: true },
  });

  if (conversation.activeBranchId) {
    return conversation.activeBranchId;
  }

  const existing = await prisma.branch.findFirst({
    where: { conversationId, parentBranchId: null },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { activeBranchId: existing.id },
    });
    return existing.id;
  }

  const main = await prisma.branch.create({
    data: {
      conversationId,
      name: "Main",
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { activeBranchId: main.id },
  });

  return main.id;
}

/**
 * Loads messages for a conversation branch as AI SDK `UIMessage`s.
 * When branchId is omitted, uses the conversation's active branch.
 */
export async function loadChatMessages(
  conversationId: string,
  branchId?: string | null
): Promise<UIMessage[]> {
  const resolvedBranchId =
    branchId ?? (await ensureActiveBranch(conversationId));

  const messageIds = await resolveBranchMessageIds(
    conversationId,
    resolvedBranchId
  );

  if (messageIds.length === 0) {
    return [];
  }

  const rows = await prisma.message.findMany({
    where: { id: { in: messageIds } },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));

  return messageIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => row.role !== "SYSTEM")
    .map((row) => ({
      id: row.id,
      role: toUIRole(row.role),
      parts: toUIMessageParts(row.parts, row.content),
    }));
}

type SaveChatMessagesOptions = {
  updateTitle?: boolean;
  branchId?: string;
};

/**
 * Upserts AI SDK `UIMessage`s into the database for a conversation branch.
 * Tool-call / tool-result data is stored inside assistant message `parts`.
 */
export async function saveChatMessages(
  conversationId: string,
  messages: UIMessage[],
  options: SaveChatMessagesOptions = {}
) {
  const { updateTitle = true } = options;
  const branchId =
    options.branchId ?? (await ensureActiveBranch(conversationId));

  for (const message of messages) {
    if (message.role === "system") continue;

    const content = getMessageText(message);
    const role = toDbRole(message.role);

    await prisma.message.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        conversationId,
        branchId,
        role,
        status: "COMPLETE",
        content,
        parts: message.parts as Prisma.InputJsonValue,
      },
      update: {
        content,
        parts: message.parts as Prisma.InputJsonValue,
        status: "COMPLETE",
      },
    });
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { title: true },
  });

  const firstUser = messages.find((message) => message.role === "user");
  const firstUserText = firstUser ? getMessageText(firstUser).trim() : "";

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      title:
        updateTitle && conversation.title === "New Chat" && firstUserText
          ? firstUserText.slice(0, 48)
          : conversation.title,
    },
  });
}
