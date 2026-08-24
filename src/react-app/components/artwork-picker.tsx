import { useState } from "react"
import { Images } from "lucide-react"

import {
  ARTWORK_OPTIONS,
  readStoredArtwork,
  setArtwork,
  storeArtwork,
  type ArtworkId,
} from "@/react-app/lib/appearance"

export function ArtworkPicker() {
  const [selectedArtwork, setSelectedArtwork] = useState(readStoredArtwork)
  const hasArtwork = ARTWORK_OPTIONS.length > 0

  const handleArtworkChange = (artwork: ArtworkId) => {
    setSelectedArtwork(artwork)
    setArtwork(artwork)
    storeArtwork(artwork)
  }

  return (
    <label className="flex h-7 w-full items-center gap-2 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <Images className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Artwork</span>
      <select
        value={selectedArtwork}
        onChange={(event) =>
          handleArtworkChange(event.target.value as ArtworkId)
        }
        className="max-w-28 rounded-sm border border-border bg-background px-1 py-0.5 text-xs outline-none"
        aria-label="Artwork"
        disabled={!hasArtwork}
      >
        {!hasArtwork ? <option value="">No artwork found</option> : null}
        {ARTWORK_OPTIONS.map((artwork) => (
          <option key={artwork.id} value={artwork.id}>
            {artwork.label}
          </option>
        ))}
      </select>
    </label>
  )
}
