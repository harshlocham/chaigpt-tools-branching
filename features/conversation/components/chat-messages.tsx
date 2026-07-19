"use client";

import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import type { ChatStatus } from "ai";
import { GitBranchIcon } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import { ToolCallCard } from "@/features/ai/components/tool-call-card";

type ChatMessagesProps = {
  messages: UIMessage[];
  status: ChatStatus;
  onBranchFromMessage?: (messageId: string) => void;
  isBranching?: boolean;
};

/**
 * Renders the conversation message list with tool calls, markdown, and branch actions.
 */
export function ChatMessages({
  messages,
  status,
  onBranchFromMessage,
  isBranching,
}: ChatMessagesProps) {
  const isWaiting =
    status === "submitted" && messages.at(-1)?.role === "user";

  return (
    <Conversation>
      <ConversationContent className="py-8">
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.parts.map((part, index) => {
                if (isTextUIPart(part) && part.text) {
                  return (
                    <MessageResponse key={`${message.id}-text-${index}`}>
                      {part.text}
                    </MessageResponse>
                  );
                }

                if (isToolUIPart(part)) {
                  return (
                    <ToolCallCard
                      key={`${message.id}-tool-${part.toolCallId ?? index}`}
                      part={part}
                    />
                  );
                }

                return null;
              })}
            </MessageContent>

            {onBranchFromMessage ? (
              <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                <MessageAction
                  tooltip="Branch from here"
                  label="Branch from here"
                  disabled={isBranching}
                  onClick={() => onBranchFromMessage(message.id)}
                >
                  <GitBranchIcon className="size-3.5" />
                </MessageAction>
              </MessageActions>
            ) : null}
          </Message>
        ))}

        {isWaiting ? (
          <Message from="assistant">
            <MessageContent>
              <Loader />
            </MessageContent>
          </Message>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
