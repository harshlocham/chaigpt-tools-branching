"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import React, { useEffect, useMemo, useRef } from "react";
import { useConversations } from "../hooks/use-conversation";
import { useCreateBranch } from "../hooks/use-branches";
import { queryKeys } from "../utils/query-keys";
import { toast } from "sonner";
import { ChatEmpty } from "./chat-empty";
import { ChatMessages } from "./chat-messages";
import { ChatComposer } from "./chat-composer";
import { BranchSwitcher } from "./branch-switcher";

type ConversationViewProps = {
  conversationId: string;
  branchId: string;
  initialMessages: UIMessage[];
  /** First message from draft chat — sent once after mount (ChatGPT-style create-on-send). */
  initialPrompt?: string;
};

/**
 * Main chat view — header with branch switcher, message list, and composer.
 */
export const ConversationView = ({
  conversationId,
  branchId,
  initialMessages,
  initialPrompt,
}: ConversationViewProps) => {
  const queryClient = useQueryClient();
  const { data: conversations } = useConversations();
  const createBranch = useCreateBranch(conversationId);
  const promptSent = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            // useChat id is `${conversationId}:${branchId}` for cache isolation —
            // always send the real conversation id to the API.
            id: conversationId,
            message: messages.at(-1),
            branchId,
          },
        }),
      }),
    [conversationId, branchId]
  );

  const { messages, sendMessage, status } = useChat({
    id: `${conversationId}:${branchId}`,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Send the draft first message once useChat is ready (ref survives Strict Mode effect re-runs)
  useEffect(() => {
    if (!initialPrompt) return;
    if (promptSent.current) return;
    if (status !== "ready") return;
    if (messages.length > 0) return;

    promptSent.current = true;
    void sendMessage({ text: initialPrompt });
  }, [initialPrompt, status, messages.length, sendMessage]);

  const title =
    conversations?.find((item) => item.id === conversationId)?.title ?? "Chat";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mx-1 h-4" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        <BranchSwitcher conversationId={conversationId} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {messages.length === 0 ? (
          <ChatEmpty />
        ) : (
          <ChatMessages
            messages={messages}
            status={status}
            isBranching={createBranch.isPending}
            onBranchFromMessage={(messageId) => {
              createBranch.mutate({ fromMessageId: messageId });
            }}
          />
        )}
      </div>

      <div className="shrink-0">
        <ChatComposer
          onSend={(text) => {
            void sendMessage({ text });
          }}
          isSending={status !== "ready"}
          autoFocus
        />
      </div>
    </div>
  );
};
