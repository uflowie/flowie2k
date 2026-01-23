import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { uploadSong } from "@/react-app/lib/api"

export function AppSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const playlists: string[] = []
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
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>All Songs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>Upload Song</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Add New Playlist</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {uploadStatus ? (
              <p className={`px-2 pt-2 text-xs ${uploadStatusClass}`}>
                {uploadStatus}
              </p>
            ) : null}
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
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Most Popular</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Most Recent</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Most Popular 30 days</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Most Popular 90 days</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <span>Most Popular 365 days</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {playlists.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>No playlists yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                playlists.map((playlist) => (
                  <SidebarMenuItem key={playlist}>
                    <SidebarMenuButton type="button">
                      <span>{playlist}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
