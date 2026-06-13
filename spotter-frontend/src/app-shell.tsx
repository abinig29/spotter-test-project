import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router";

import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

export default function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-svh">
        <Outlet />
      </div>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
