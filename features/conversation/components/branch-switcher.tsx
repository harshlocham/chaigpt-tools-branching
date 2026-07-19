"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  GitBranchIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  useBranches,
  useDeleteBranch,
  useRenameBranch,
  useSwitchBranch,
} from "@/features/conversation/hooks/use-branches";
import { cn } from "@/lib/utils";

type BranchSwitcherProps = {
  conversationId: string;
};

/**
 * Header control to switch, rename, and delete conversation branches.
 */
export function BranchSwitcher({ conversationId }: BranchSwitcherProps) {
  const { data: branches, isLoading } = useBranches(conversationId);
  const switchBranch = useSwitchBranch(conversationId);
  const renameBranch = useRenameBranch(conversationId);
  const deleteBranch = useDeleteBranch(conversationId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const active = branches?.find((b) => b.isActive) ?? branches?.[0];

  function openRename(branch: { id: string; name: string }) {
    setRenameTarget(branch);
    setRenameValue(branch.name);
    setRenameOpen(true);
  }

  function submitRename() {
    if (!renameTarget) return;
    renameBranch.mutate(
      { branchId: renameTarget.id, name: renameValue },
      {
        onSuccess: () => {
          setRenameOpen(false);
          setRenameTarget(null);
        },
      }
    );
  }

  if (isLoading || !branches?.length) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled>
        <GitBranchIcon className="size-3.5" />
        <span className="max-w-32 truncate">Main</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="gap-1.5" />}
        >
          <GitBranchIcon className="size-3.5" />
          <span className="max-w-40 truncate">{active?.name ?? "Branch"}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch.id}
              className="gap-2"
              onClick={() => {
                if (!branch.isActive) {
                  switchBranch.mutate(branch.id);
                }
              }}
            >
              <CheckIcon
                className={cn(
                  "size-3.5 shrink-0",
                  branch.isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
            </DropdownMenuItem>
          ))}
          {active ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openRename(active)}
              >
                <PencilIcon className="size-3.5" />
                Rename “{active.name}”
              </DropdownMenuItem>
              {!active.isMain ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => deleteBranch.mutate(active.id)}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete “{active.name}”
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Hover a message and click the branch icon to fork
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename branch</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Branch name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitRename}
              disabled={!renameValue.trim() || renameBranch.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
