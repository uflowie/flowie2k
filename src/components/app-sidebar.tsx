import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import {
  CalendarRange,
  ChevronDown,
  Flame,
  FolderUp,
  ListMusic,
  ListPlus,
  Music,
  Upload,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import {
  getPlaylistStatusMessage,
  SMART_PLAYLISTS,
  toCustomPlaylist,
  type ActivePlaylist,
  type SmartPlaylistId,
} from "@/react-app/lib/playlists"
import {
  invalidateSongsQuery,
  prefetchSongsQuery,
  uploadSong,
  useCreatePlaylistMutation,
  usePlaylistsQuery,
  useUploadSongMutation,
} from "@/react-app/lib/queries"
import { usePlaybackStore } from "@/react-app/lib/playback-store"
import { AppearanceColorControls } from "@/react-app/components/background-color-picker"
import { PlaylistWidthSlider } from "@/react-app/components/playlist-width-slider"
import { SidebarWidthSlider } from "@/react-app/components/sidebar-width-slider"
import { ArtworkPicker } from "@/react-app/components/artwork-picker"
import { ArtworkPositionControls } from "@/react-app/components/artwork-position-controls"
import { AppearancePresets } from "@/react-app/components/appearance-presets"
import { toast } from "sonner"

const SMART_PLAYLIST_ICONS: Record<SmartPlaylistId, LucideIcon> = {
  "all": Music,
  "popular-30": Flame,
  "popular-90": TrendingUp,
  "popular-365": CalendarRange,
}

export function AppSidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [customizationOpen, setCustomizationOpen] = useState(true)
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
  const uploadMutation = useUploadSongMutation()
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
  } = usePlaylistsQuery()
  const playlists = playlistsResponse?.playlists ?? []
  const playlistStatusMessage = getPlaylistStatusMessage({
    playlists,
    isLoading: playlistsLoading,
    isError: playlistsError,
  })

  const createPlaylistMutation = useCreatePlaylistMutation()

  const prefetchPlaylist = (playlist: ActivePlaylist) => {
    void prefetchSongsQuery(queryClient, playlist)
  }

  const handleCreatePlaylist = () => {
    const name = window.prompt("Name your playlist")
    if (!name || !name.trim()) {
      return
    }
    createPlaylistMutation.mutate(name.trim(), {
      onSuccess: (data) => {
        const playlist = {
          type: "custom",
          id: data.id,
          name: data.name,
        } as const
        setActivePlaylist(playlist)
        void navigate({
          to: "/playlists/$playlistId",
          params: { playlistId: String(playlist.id) },
        })
      },
    })
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

    await invalidateSongsQuery(queryClient)

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
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  disabled={uploadMutation.isPending || isFolderUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload />
                  <span>Upload Song</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  disabled={uploadMutation.isPending || isFolderUploading}
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp />
                  <span>Upload Folder</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  disabled={createPlaylistMutation.isPending}
                  onClick={handleCreatePlaylist}
                >
                  <ListPlus />
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
                  uploadMutation.mutate(file, {
                    onSuccess: () => {
                      toast.success("Upload complete.")
                    },
                    onSettled: () => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    },
                  })
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

        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <button
              type="button"
              aria-controls="customization-content"
              aria-expanded={customizationOpen}
              onClick={() => setCustomizationOpen((open) => !open)}
              className="w-full justify-between text-left"
            >
              <span>Customization</span>
              <ChevronDown
                aria-hidden="true"
                className={`transition-transform ${customizationOpen ? "rotate-180" : ""}`}
              />
            </button>
          </SidebarGroupLabel>
          {customizationOpen ? (
            <SidebarGroupContent id="customization-content">
              <SidebarMenu>
                <AppearancePresets />
                <AppearanceColorControls />
                <SidebarMenuItem>
                  <ArtworkPicker />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <ArtworkPositionControls />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarWidthSlider />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <PlaylistWidthSlider />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          ) : null}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Mixes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SMART_PLAYLISTS.map((playlist) => {
                const Icon = SMART_PLAYLIST_ICONS[playlist.id]
                const isActive =
                  activePlaylist.type === "smart" &&
                  activePlaylist.id === playlist.id
                return (
                  <SidebarMenuItem key={playlist.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="relative data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-primary"
                    >
                      <Link
                        to="/playlists/$playlistId"
                        params={{ playlistId: playlist.id }}
                        onClick={() => setActivePlaylist(playlist)}
                        onMouseEnter={() => prefetchPlaylist(playlist)}
                        onFocus={() => prefetchPlaylist(playlist)}
                      >
                        <Icon className={isActive ? "text-foreground" : undefined} />
                        <span>{playlist.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Playlists</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {playlistStatusMessage ? (
                <SidebarMenuItem>
                  <SidebarMenuButton type="button" disabled>
                    <span>{playlistStatusMessage}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                playlists.map((playlist) => {
                  const playlistData = toCustomPlaylist(playlist)
                  const isActive =
                    activePlaylist.type === "custom" &&
                    activePlaylist.id === playlistData.id
                  return (
                    <SidebarMenuItem key={playlist.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="relative data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-primary"
                      >
                        <Link
                          to="/playlists/$playlistId"
                          params={{ playlistId: String(playlist.id) }}
                          onClick={() => setActivePlaylist(playlistData)}
                          onMouseEnter={() => prefetchPlaylist(playlistData)}
                          onFocus={() => prefetchPlaylist(playlistData)}
                        >
                          <ListMusic className={isActive ? "text-foreground" : undefined} />
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
