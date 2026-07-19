"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createBranch,
  deleteBranch,
  listBranches,
  renameBranch,
  switchBranch,
} from "@/features/conversation/actions/branch-actions";
import { queryKeys } from "../utils/query-keys";

/** Fetches branches for a conversation. */
export function useBranches(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.branches.byConversation(conversationId),
    queryFn: () => listBranches(conversationId),
    enabled: Boolean(conversationId),
  });
}

/** Create a branch from a message and refresh the conversation page. */
export function useCreateBranch(conversationId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: { fromMessageId: string; name?: string }) =>
      createBranch({ conversationId, ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.branches.byConversation(conversationId),
      });
      toast.success("Branch created");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not create branch");
    },
  });
}

/** Switch the active branch and reload messages. */
export function useSwitchBranch(conversationId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (branchId: string) => switchBranch(conversationId, branchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.branches.byConversation(conversationId),
      });
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not switch branch");
    },
  });
}

/** Rename a branch. */
export function useRenameBranch(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, name }: { branchId: string; name: string }) =>
      renameBranch(branchId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.branches.byConversation(conversationId),
      });
      toast.success("Branch renamed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not rename branch");
    },
  });
}

/** Delete a branch and refresh if the active path changed. */
export function useDeleteBranch(conversationId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (branchId: string) => deleteBranch(branchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.branches.byConversation(conversationId),
      });
      toast.success("Branch deleted");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not delete branch");
    },
  });
}
