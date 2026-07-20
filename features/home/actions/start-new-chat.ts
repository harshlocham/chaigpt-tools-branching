"use server";

import { requireUser } from "@/features/auth/action/require-user";
import { prisma } from "@/lib/db";

export type StartNewChatResult = {
  conversationId: string;
  branchId: string;
};

/**
 * Creates a new conversation with a Main branch.
 * Call this only when the user actually sends their first message.
 */
export async function startNewChat(): Promise<StartNewChatResult> {
  const user = await requireUser();

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: "New Chat",
      branches: {
        create: {
          name: "Main",
        },
      },
    },
    include: { branches: true },
  });

  const mainBranch = conversation.branches[0];
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { activeBranchId: mainBranch.id },
  });

  return {
    conversationId: conversation.id,
    branchId: mainBranch.id,
  };
}
