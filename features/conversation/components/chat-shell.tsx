"use client";

import { AppSidebar } from "@/features/conversation/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * App shell with collapsible sidebar and main content area for chat views.
 * Uses a fixed viewport height so the message list + composer flex layout works.
 */
export function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-svh !min-h-0">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
