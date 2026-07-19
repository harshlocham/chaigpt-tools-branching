import { loadChatMessages, ensureActiveBranch } from "@/features/ai/actions/chat-store";
import { getConversation } from "@/features/conversation/actions/conversation-actions";
import { ConversationView } from "@/features/conversation/components/conversation-view";
import { notFound } from "next/navigation";
import React from "react";

type ConversationPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Conversation page — loads the active branch messages and renders the chat UI.
 */
const page = async ({ params }: ConversationPageProps) => {
  const { id } = await params;

  try {
    await getConversation(id);
  } catch {
    notFound();
  }

  const branchId = await ensureActiveBranch(id);
  const initialMessages = await loadChatMessages(id, branchId);

  return (
    <ConversationView
      key={`${id}:${branchId}`}
      conversationId={id}
      branchId={branchId}
      initialMessages={initialMessages}
    />
  );
};

export default page;
