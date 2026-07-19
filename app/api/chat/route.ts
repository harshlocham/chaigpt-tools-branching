import {
  ensureActiveBranch,
  loadChatMessages,
  saveChatMessages,
} from "@/features/ai/actions/chat-store";
import { chatTools } from "@/features/ai/tools";
import { getChatModel } from "@/features/ai/utils/model";
import { requireUser } from "@/features/auth/action/require-user";
import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

const SYSTEM_PROMPT = `You are ChaiGPT, a helpful assistant.

When the user asks about current events, recent data, live facts, or anything you may not know reliably, use the webSearch tool before answering.
After searching, synthesize a clear answer and cite sources when relevant.`;

/**
 * POST /api/chat — Streams an AI assistant reply for a conversation branch.
 *
 * Validates auth and ownership, persists the user message, then streams the
 * assistant response (with optional web search tool calls) via the AI SDK.
 */
export async function POST(req: Request) {
  await auth.protect();

  const {
    message,
    id,
    branchId: requestedBranchId,
  }: { message: UIMessage; id: string; branchId?: string } = await req.json();

  if (!message || !id) {
    return new Response("Missing message or conversation id", { status: 400 });
  }

  const user = await requireUser();

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const branchId =
    requestedBranchId ??
    conversation.activeBranchId ??
    (await ensureActiveBranch(id));

  if (requestedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedBranchId, conversationId: id },
    });
    if (!branch) {
      return new Response("Branch not found", { status: 404 });
    }
  }

  const previousMessages = await loadChatMessages(id, branchId);

  const alreadySaved = previousMessages.some(
    (storedMessage) => storedMessage.id === message.id
  );

  const messages = alreadySaved
    ? previousMessages
    : [...previousMessages, message];

  if (!alreadySaved) {
    await saveChatMessages(id, [message], { branchId });
  }

  const result = streamText({
    model: getChatModel(conversation.model),
    system: conversation.systemPrompt ?? SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: stepCountIs(5),
  });

  result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({ messages: finalMessages }) => {
        try {
          await saveChatMessages(id, finalMessages, {
            updateTitle: false,
            branchId,
          });
        } catch (error) {
          console.error(error);
        }
      },
    }),
  });
}
