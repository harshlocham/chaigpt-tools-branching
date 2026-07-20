"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { startNewChat } from "@/features/home/actions/start-new-chat";
import { ChatComposer } from "@/features/conversation/components/chat-composer";
import { ChatEmpty } from "@/features/conversation/components/chat-empty";
import { ConversationView } from "@/features/conversation/components/conversation-view";
import { queryKeys } from "@/features/conversation/utils/query-keys";

/**
 * Draft chat UI on `/` — looks like a new chat but does not write to the DB
 * until the user sends their first message. Then switches to ConversationView
 * in-place (URL updated via history) so useChat is not remounted mid-send.
 */
export function DraftChatView() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [active, setActive] = useState<{
    conversationId: string;
    branchId: string;
    initialPrompt: string;
  } | null>(null);

  async function handleSend(text: string) {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const { conversationId, branchId } = await startNewChat();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      // Soft URL update — avoids Next.js remounting a new page before the stream starts
      window.history.replaceState(null, "", `/c/${conversationId}`);
      setActive({ conversationId, branchId, initialPrompt: text });
    } catch (error) {
      setIsCreating(false);
      toast.error(
        error instanceof Error ? error.message : "Could not start chat"
      );
    }
  }

  if (active) {
    return (
      <ConversationView
        conversationId={active.conversationId}
        branchId={active.branchId}
        initialMessages={[]}
        initialPrompt={active.initialPrompt}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">New Chat</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatEmpty />
      </div>

      <div className="shrink-0">
        <ChatComposer
          onSend={(text) => {
            void handleSend(text);
          }}
          isSending={isCreating}
          autoFocus
        />
      </div>
    </div>
  );
}
