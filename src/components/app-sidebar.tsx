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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { createPlaylist, fetchPlaylists, uploadSong } from "@/react-app/lib/api"
import { usePlayer, type SmartPlaylist } from "@/react-app/lib/player"
import { toast } from "sonner"

export function AppSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const { activePlaylist, setActivePlaylist } = usePlayer()
  const uploadMutation = useMutation({
    mutationFn: uploadSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] })
      toast.success("Upload complete.")
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
      : null
  const uploadStatusClass = uploadMutation.isError
    ? "text-destructive"
    : "text-muted-foreground"
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
  })
  const playlists = (playlistsResponse as {
    playlists?: { id: number; name: string }[]
  })?.playlists ?? []
  const createPlaylistMutation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      if (data && typeof data === "object" && "id" in data && "name" in data) {
        setActivePlaylist({
          type: "custom",
          id: Number(data.id),
          name: String(data.name),
        })
      }
    },
  })

  const selectSmartPlaylist = (playlist: SmartPlaylist) => {
    setActivePlaylist(playlist)
  }

  const handleCreatePlaylist = () => {
    const name = window.prompt("Name your playlist")
    if (!name || !name.trim()) {
      return
    }
    createPlaylistMutation.mutate(name.trim())
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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
                <SidebarMenuButton
                  type="button"
                  disabled={createPlaylistMutation.isPending}
                  onClick={handleCreatePlaylist}
                >
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
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "all"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "all",
                      name: "All Songs",
                      sort: "recent",
                    })
                  }
                >
                  <span>All Songs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "popular",
                      name: "Most Popular",
                      sort: "popular",
                    })
                  }
                >
                  <span>Most Popular</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "recent"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "recent",
                      name: "Most Recent",
                      sort: "recent",
                    })
                  }
                >
                  <span>Most Recent</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-30"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "popular-30",
                      name: "Most Popular 30 days",
                      sort: "popular",
                      days: 30,
                    })
                  }
                >
                  <span>Most Popular 30 days</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-90"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "popular-90",
                      name: "Most Popular 90 days",
                      sort: "popular",
                      days: 90,
                    })
                  }
                >
                  <span>Most Popular 90 days</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-365"
                  }
                  onClick={() =>
                    selectSmartPlaylist({
                      type: "smart",
                      id: "popular-365",
                      name: "Most Popular 365 days",
                      sort: "popular",
                      days: 365,
                    })
                  }
                >
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
              {playlistsLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>Loading playlists...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : playlistsError ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>Failed to load playlists</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : playlists.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>No playlists yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                playlists.map((playlist) => (
                  <SidebarMenuItem key={playlist.id}>
                    <SidebarMenuButton
                      type="button"
                      isActive={
                        activePlaylist.type === "custom" &&
                        activePlaylist.id === Number(playlist.id)
                      }
                      onClick={() =>
                        setActivePlaylist({
                          type: "custom",
                          id: Number(playlist.id),
                          name: playlist.name,
                        })
                      }
                    >
                      <span>{playlist.name}</span>
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
