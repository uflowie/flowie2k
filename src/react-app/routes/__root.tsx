import { createRootRoute, Outlet } from '@tanstack/react-router'
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { PlaybackControls } from "@/react-app/components/playback-controls"

const RootLayout = () => (
  <>
    <div className="flex h-svh flex-col overflow-hidden">
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar />
        <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex min-h-0 w-full flex-1 flex-col md:w-[var(--playlist-pane-width,97%)]">
            <Outlet />
          </div>
        </div>
        {/* <TanStackRouterDevtools /> */}
      </SidebarProvider>
      <PlaybackControls />
    </div>
    <Toaster />
  </>
)

export const Route = createRootRoute({ component: RootLayout })
