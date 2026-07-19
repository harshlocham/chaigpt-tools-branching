"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/action/require-user";
import { prisma } from "@/lib/db";

export type BranchListItem = {
  id: string;
  conversationId: string;
  name: string;
  parentBranchId: string | null;
  forkFromMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isMain: boolean;
};

async function assertOwnsConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return conversation;
}

/**
 * Lists all branches for a conversation owned by the current user.
 */
export async function listBranches(
  conversationId: string
): Promise<BranchListItem[]> {
  const user = await requireUser();
  const conversation = await assertOwnsConversation(conversationId, user.id);

  const branches = await prisma.branch.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return branches.map((branch) => ({
    id: branch.id,
    conversationId: branch.conversationId,
    name: branch.name,
    parentBranchId: branch.parentBranchId,
    forkFromMessageId: branch.forkFromMessageId,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
    isActive: conversation.activeBranchId === branch.id,
    isMain: branch.parentBranchId === null,
  }));
}

/**
 * Creates a new branch forked from a message and switches to it.
 */
export async function createBranch(input: {
  conversationId: string;
  fromMessageId: string;
  name?: string;
}) {
  const user = await requireUser();
  const conversation = await assertOwnsConversation(
    input.conversationId,
    user.id
  );

  const forkMessage = await prisma.message.findFirst({
    where: {
      id: input.fromMessageId,
      conversationId: input.conversationId,
    },
  });

  if (!forkMessage) {
    throw new Error("Message not found");
  }

  const parentBranchId =
    forkMessage.branchId ||
    conversation.activeBranchId ||
    (
      await prisma.branch.findFirst({
        where: { conversationId: input.conversationId, parentBranchId: null },
      })
    )?.id;

  if (!parentBranchId) {
    throw new Error("No parent branch found");
  }

  const siblingCount = await prisma.branch.count({
    where: { conversationId: input.conversationId },
  });

  const name =
    input.name?.trim() ||
    `Branch ${siblingCount}`;

  const branch = await prisma.branch.create({
    data: {
      conversationId: input.conversationId,
      name,
      parentBranchId,
      forkFromMessageId: input.fromMessageId,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { activeBranchId: branch.id },
  });

  revalidatePath(`/c/${input.conversationId}`);

  return branch;
}

/**
 * Switches the conversation's active branch.
 */
export async function switchBranch(conversationId: string, branchId: string) {
  const user = await requireUser();
  await assertOwnsConversation(conversationId, user.id);

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, conversationId },
  });

  if (!branch) {
    throw new Error("Branch not found");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { activeBranchId: branchId },
  });

  revalidatePath(`/c/${conversationId}`);

  return branch;
}

/**
 * Renames a branch owned by the current user.
 */
export async function renameBranch(branchId: string, name: string) {
  const user = await requireUser();
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Branch name cannot be empty");
  }

  const existing = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { conversation: true },
  });

  if (!existing || existing.conversation.userId !== user.id) {
    throw new Error("Branch not found");
  }

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: { name: trimmed },
  });

  revalidatePath(`/c/${existing.conversationId}`);
  return branch;
}

/**
 * Deletes a non-main branch and its owned messages.
 * Switches active branch to parent (or Main) when needed.
 */
export async function deleteBranch(branchId: string) {
  const user = await requireUser();

  const existing = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { conversation: true },
  });

  if (!existing || existing.conversation.userId !== user.id) {
    throw new Error("Branch not found");
  }

  if (existing.parentBranchId === null) {
    throw new Error("Cannot delete the Main branch");
  }

  const branchCount = await prisma.branch.count({
    where: { conversationId: existing.conversationId },
  });

  if (branchCount <= 1) {
    throw new Error("Cannot delete the last branch");
  }

  const wasActive = existing.conversation.activeBranchId === branchId;
  const fallbackId =
    existing.parentBranchId ??
    (
      await prisma.branch.findFirst({
        where: {
          conversationId: existing.conversationId,
          parentBranchId: null,
        },
      })
    )?.id;

  // Re-parent children onto this branch's parent before delete
  await prisma.branch.updateMany({
    where: { parentBranchId: branchId },
    data: { parentBranchId: existing.parentBranchId },
  });

  await prisma.branch.delete({ where: { id: branchId } });

  if (wasActive && fallbackId) {
    await prisma.conversation.update({
      where: { id: existing.conversationId },
      data: { activeBranchId: fallbackId },
    });
  }

  revalidatePath(`/c/${existing.conversationId}`);

  return {
    id: branchId,
    conversationId: existing.conversationId,
    activeBranchId: wasActive ? fallbackId : existing.conversation.activeBranchId,
  };
}

/**
 * Returns the active branch id for a conversation (creating Main if missing).
 */
export async function getActiveBranchId(conversationId: string) {
  const user = await requireUser();
  const conversation = await assertOwnsConversation(conversationId, user.id);

  if (conversation.activeBranchId) {
    return conversation.activeBranchId;
  }

  const main = await prisma.branch.findFirst({
    where: { conversationId, parentBranchId: null },
    orderBy: { createdAt: "asc" },
  });

  if (main) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { activeBranchId: main.id },
    });
    return main.id;
  }

  const created = await prisma.branch.create({
    data: { conversationId, name: "Main" },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { activeBranchId: created.id },
  });

  return created.id;
}
