import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { PlayerProvider } from "@/react-app/lib/player"
import { Toaster } from "@/components/ui/sonner"

const RootLayout = () => (
  <PlayerProvider>
    <SidebarProvider>
      <AppSidebar />
      <Outlet />
      <TanStackRouterDevtools />
    </SidebarProvider>
    <Toaster />
  </PlayerProvider>
)

export const Route = createRootRoute({ component: RootLayout })
