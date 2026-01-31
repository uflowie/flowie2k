import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { PlaybackControls } from "@/react-app/components/playback-controls"

const RootLayout = () => (
  <>
    <SidebarProvider>
      <AppSidebar />
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
        <div className="sticky bottom-0 z-20 mt-auto px-6 pb-6">
          <PlaybackControls />
        </div>
      </div>
      <TanStackRouterDevtools />
    </SidebarProvider>
    <Toaster />
  </>
)

export const Route = createRootRoute({ component: RootLayout })
