"use server";

import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { onBoard } from "@/features/auth/action/onboard";

/**
 * Ensures the request is authenticated and a Prisma `User` exists for the Clerk session.
 * Falls back to onboarding when the layout/page race means the user row is not created yet.
 *
 * @returns The Prisma `User` linked to the current Clerk session.
 */
export async function requireUser() {
  const { userId } = await auth.protect();

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return onBoard();
  }

  return user;
}
