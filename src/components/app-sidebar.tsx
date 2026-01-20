import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Plus, Music, ChartBar } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { uploadSong } from "@/react-app/lib/api"

export function AppSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const uploadMutation = useMutation({
    mutationFn: uploadSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] })
    },
    onSettled: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
  })
  const uploadStatus = uploadMutation.isPending
    ? "Uploading..."
    : uploadMutation.isError
      ? uploadMutation.error instanceof Error
        ? uploadMutation.error.message
        : "Upload failed."
      : uploadMutation.isSuccess
        ? "Upload complete."
        : null
  const uploadStatusClass = uploadMutation.isError
    ? "text-destructive"
    : "text-muted-foreground"

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Songs</SidebarGroupLabel>
          <SidebarGroupAction
            title={uploadMutation.isPending ? "Uploading..." : "Add Song"}
            aria-label="Add Song"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus />
          </SidebarGroupAction>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="audio/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              uploadMutation.reset()
              if (file) {
                uploadMutation.mutate(file)
              }
            }}
          />
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/songs">
                    <Music />
                    <span>All</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuButton asChild>
                  <Link to="/songs">
                    <ChartBar />
                    <span>Statistics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {uploadStatus ? (
              <p className={`px-2 pt-2 text-xs ${uploadStatusClass}`}>
                {uploadStatus}
              </p>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Playlists</SidebarGroupLabel>
          <SidebarGroupAction title="Add Playlist">
            <Plus />
          </SidebarGroupAction>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
