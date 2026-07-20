import { DraftChatView } from "@/features/conversation/components/draft-chat-view";

/**
 * Home page — shows a draft "New Chat" UI.
 * The conversation is only created in the database when the user sends a message.
 */
export default function Page() {
  return <DraftChatView />;
}
