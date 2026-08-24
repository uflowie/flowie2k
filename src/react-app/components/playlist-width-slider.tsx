import { useEffect, useState } from "react"
import { Columns3 } from "lucide-react"

import { Slider } from "@/components/ui/slider"
import {
  APPEARANCE_CHANGE_EVENT,
  MAX_PLAYLIST_WIDTH,
  MIN_PLAYLIST_WIDTH,
  notifyAppearanceChange,
  readStoredPlaylistWidth,
  setPlaylistWidth,
  storePlaylistWidth,
} from "@/react-app/lib/appearance"

export function PlaylistWidthSlider() {
  const [width, setWidth] = useState(readStoredPlaylistWidth)

  useEffect(() => {
    const handleAppearanceChange = () =>
      setWidth(readStoredPlaylistWidth())
    window.addEventListener(APPEARANCE_CHANGE_EVENT, handleAppearanceChange)
    return () =>
      window.removeEventListener(
        APPEARANCE_CHANGE_EVENT,
        handleAppearanceChange,
      )
  }, [])

  return (
    <div className="space-y-2 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <div className="flex items-center gap-2">
        <Columns3 className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Playlist width</span>
        <output className="w-9 text-right tabular-nums">{width}%</output>
      </div>
      <Slider
        min={MIN_PLAYLIST_WIDTH}
        max={MAX_PLAYLIST_WIDTH}
        step={1}
        value={[width]}
        onValueChange={(values) => {
          const nextWidth = values[0]
          if (typeof nextWidth !== "number") {
            return
          }
          setWidth(nextWidth)
          setPlaylistWidth(nextWidth)
        }}
        onValueCommit={(values) => {
          const nextWidth = values[0]
          if (typeof nextWidth === "number") {
            storePlaylistWidth(nextWidth)
            notifyAppearanceChange("customization")
          }
        }}
        aria-label="Playlist width"
      />
    </div>
  )
}
