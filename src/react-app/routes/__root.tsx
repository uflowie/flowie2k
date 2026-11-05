import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PlaybackControls } from "@/react-app/components/playback-controls";

const RootLayout = () => (
  <>
    {/* Full screen on phones, kept clear of the status bar; the player keeps clear of the home indicator. */}
    <div className="flex h-svh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar />
        <div className="relative isolate flex h-full w-full flex-1 flex-col overflow-hidden">
          <div
            aria-hidden="true"
            className="background-artwork pointer-events-none absolute right-6 bottom-5 z-0 h-[78vh] w-[min(76vw,72rem)] select-none"
          />
          <div className="relative z-10 mx-auto flex min-h-0 w-full flex-1 flex-col md:w-[var(--playlist-pane-width,97%)]">
            <Outlet />
          </div>
        </div>
        {/* <TanStackRouterDevtools /> */}
      </SidebarProvider>
      <PlaybackControls />
    </div>
    <Toaster />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
