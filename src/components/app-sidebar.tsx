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
import { useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { createPlaylist, fetchPlaylists, uploadSong } from "@/react-app/lib/api"
import { fetchSongsForPlaylist } from "@/react-app/lib/songs"
import {
  getPlaylistKey,
  usePlaybackStore,
  type ActivePlaylist,
  type SmartPlaylist,
} from "@/react-app/lib/playback-store"
import { toast } from "sonner"

const SMART_ALL: SmartPlaylist = {
  type: "smart",
  id: "all",
  name: "All Songs",
  sort: "recent",
}

const SMART_POPULAR_30: SmartPlaylist = {
  type: "smart",
  id: "popular-30",
  name: "Most Popular 30 days",
  sort: "popular",
  days: 30,
}

const SMART_POPULAR_90: SmartPlaylist = {
  type: "smart",
  id: "popular-90",
  name: "Most Popular 90 days",
  sort: "popular",
  days: 90,
}

const SMART_POPULAR_365: SmartPlaylist = {
  type: "smart",
  id: "popular-365",
  name: "Most Popular 365 days",
  sort: "popular",
  days: 365,
}

export function AppSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const queryClient = useQueryClient()
  const activePlaylist = usePlaybackStore((state) => state.activePlaylist)
  const setActivePlaylist = usePlaybackStore((state) => state.setActivePlaylist)
  const navigate = useNavigate()
  const [folderUploadProgress, setFolderUploadProgress] = useState<{
    total: number
    completed: number
    failed: number
    inProgress: boolean
  } | null>(null)
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
  const folderUploadStatus = folderUploadProgress
    ? folderUploadProgress.inProgress
      ? `Uploading folder... ${folderUploadProgress.completed}/${folderUploadProgress.total}`
      : folderUploadProgress.failed > 0
        ? `Folder upload finished (${folderUploadProgress.total - folderUploadProgress.failed}/${folderUploadProgress.total} ok)`
        : `Folder upload complete (${folderUploadProgress.total})`
    : null
  const isFolderUploading = folderUploadProgress?.inProgress ?? false
  const uploadStatus = uploadMutation.isPending
    ? "Uploading..."
    : uploadMutation.isError
      ? uploadMutation.error instanceof Error
        ? uploadMutation.error.message
        : "Upload failed."
      : null
  const uploadStatusClass = folderUploadStatus
    ? folderUploadProgress?.failed
      ? "text-destructive"
      : "text-muted-foreground"
    : uploadMutation.isError
      ? "text-destructive"
      : "text-muted-foreground"
  const mergedUploadStatus = folderUploadStatus ?? uploadStatus
  const {
    data: playlistsResponse,
    isLoading: playlistsLoading,
    isError: playlistsError,
  } = useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
  const playlists = (playlistsResponse as {
    playlists?: { id: number; name: string }[]
  })?.playlists ?? []

  const createPlaylistMutation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      if (data && typeof data === "object" && "id" in data && "name" in data) {
        const playlist = {
          type: "custom",
          id: Number(data.id),
          name: String(data.name),
        } as const
        setActivePlaylist(playlist)
        void navigate({
          to: "/playlists/$playlistId",
          params: { playlistId: String(playlist.id) },
        })
      }
    },
  })

  const prefetchPlaylist = (playlist: ActivePlaylist) => {
    const playlistKey = getPlaylistKey(playlist)
    void queryClient.prefetchQuery({
      queryKey: ["songs", playlistKey],
      queryFn: () => fetchSongsForPlaylist(playlist),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    })
  }

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

  const handleUploadFolder = async (files: File[]) => {
    if (!files.length) {
      return
    }

    const total = files.length
    let completed = 0
    let failed = 0
    setFolderUploadProgress({
      total,
      completed,
      failed,
      inProgress: true,
    })

    for (const file of files) {
      try {
        await uploadSong(file)
      } catch (error) {
        failed += 1
        console.error("[UPLOAD] Failed to upload file:", error)
      } finally {
        completed += 1
        setFolderUploadProgress({
          total,
          completed,
          failed,
          inProgress: completed < total,
        })
      }
    }

    queryClient.invalidateQueries({ queryKey: ["songs"] })

    if (failed === 0) {
      toast.success(`Uploaded ${completed} songs.`)
    } else {
      toast.error(`Uploaded ${completed - failed} of ${completed} songs.`)
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = ""
    }
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
                  disabled={uploadMutation.isPending || isFolderUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>Upload Song</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  disabled={uploadMutation.isPending || isFolderUploading}
                  onClick={() => folderInputRef.current?.click()}
                >
                  <span>Upload Folder</span>
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
            {mergedUploadStatus ? (
              <p className={`px-2 pt-2 text-xs ${uploadStatusClass}`}>
                {mergedUploadStatus}
              </p>
            ) : null}
            <Input
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
            <Input
              ref={folderInputRef}
              className="sr-only"
              type="file"
              accept="audio/*"
              multiple
              // @ts-expect-error - nonstandard attribute for directory selection
              webkitdirectory=""
              mozdirectory=""
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                void handleUploadFolder(files)
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
                  asChild
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "all"
                  }
                >
                  <Link
                    to="/playlists/$playlistId"
                    params={{ playlistId: "all" }}
                    onClick={() =>
                      selectSmartPlaylist(SMART_ALL)
                    }
                    onMouseEnter={() => prefetchPlaylist(SMART_ALL)}
                    onFocus={() => prefetchPlaylist(SMART_ALL)}
                  >
                    <span>All Songs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-30"
                  }
                >
                  <Link
                    to="/playlists/$playlistId"
                    params={{ playlistId: "popular-30" }}
                    onClick={() =>
                      selectSmartPlaylist(SMART_POPULAR_30)
                    }
                    onMouseEnter={() => prefetchPlaylist(SMART_POPULAR_30)}
                    onFocus={() => prefetchPlaylist(SMART_POPULAR_30)}
                  >
                    <span>Most Popular 30 days</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-90"
                  }
                >
                  <Link
                    to="/playlists/$playlistId"
                    params={{ playlistId: "popular-90" }}
                    onClick={() =>
                      selectSmartPlaylist(SMART_POPULAR_90)
                    }
                    onMouseEnter={() => prefetchPlaylist(SMART_POPULAR_90)}
                    onFocus={() => prefetchPlaylist(SMART_POPULAR_90)}
                  >
                    <span>Most Popular 90 days</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    activePlaylist.type === "smart" &&
                    activePlaylist.id === "popular-365"
                  }
                >
                  <Link
                    to="/playlists/$playlistId"
                    params={{ playlistId: "popular-365" }}
                    onClick={() =>
                      selectSmartPlaylist(SMART_POPULAR_365)
                    }
                    onMouseEnter={() => prefetchPlaylist(SMART_POPULAR_365)}
                    onFocus={() => prefetchPlaylist(SMART_POPULAR_365)}
                  >
                    <span>Most Popular 365 days</span>
                  </Link>
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
                playlists.map((playlist) => {
                  const playlistData = {
                    type: "custom",
                    id: Number(playlist.id),
                    name: playlist.name,
                  } as const
                  return (
                    <SidebarMenuItem key={playlist.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          activePlaylist.type === "custom" &&
                          activePlaylist.id === playlistData.id
                        }
                      >
                        <Link
                          to="/playlists/$playlistId"
                          params={{ playlistId: String(playlist.id) }}
                          onClick={() => setActivePlaylist(playlistData)}
                          onMouseEnter={() => prefetchPlaylist(playlistData)}
                          onFocus={() => prefetchPlaylist(playlistData)}
                        >
                          <span>{playlist.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
