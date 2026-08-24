import { useState } from "react"
import { MoveHorizontal, MoveVertical, Scaling } from "lucide-react"

import { Slider } from "@/components/ui/slider"
import {
  MAX_ARTWORK_POSITION,
  MAX_ARTWORK_SIZE,
  MIN_ARTWORK_POSITION,
  MIN_ARTWORK_SIZE,
  readStoredArtworkPositionX,
  readStoredArtworkPositionY,
  readStoredArtworkSize,
  setArtworkPositionX,
  setArtworkPositionY,
  setArtworkSize,
  storeArtworkPositionX,
  storeArtworkPositionY,
  storeArtworkSize,
} from "@/react-app/lib/appearance"

const formatPosition = (position: number) =>
  `${position > 0 ? "+" : ""}${position}%`

export function ArtworkPositionControls() {
  const [size, setSize] = useState(readStoredArtworkSize)
  const [positionX, setPositionX] = useState(readStoredArtworkPositionX)
  const [positionY, setPositionY] = useState(readStoredArtworkPositionY)

  return (
    <div className="space-y-3 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Scaling className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Artwork size</span>
          <output className="w-10 text-right tabular-nums">{size}%</output>
        </div>
        <Slider
          min={MIN_ARTWORK_SIZE}
          max={MAX_ARTWORK_SIZE}
          step={1}
          value={[size]}
          onValueChange={(values) => {
            const nextSize = values[0]
            if (typeof nextSize !== "number") {
              return
            }
            setSize(nextSize)
            setArtworkSize(nextSize)
          }}
          onValueCommit={(values) => {
            const nextSize = values[0]
            if (typeof nextSize === "number") {
              storeArtworkSize(nextSize)
            }
          }}
          aria-label="Artwork size"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MoveHorizontal className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Artwork X</span>
          <output className="w-10 text-right tabular-nums">
            {formatPosition(positionX)}
          </output>
        </div>
        <Slider
          min={MIN_ARTWORK_POSITION}
          max={MAX_ARTWORK_POSITION}
          step={1}
          value={[positionX]}
          onValueChange={(values) => {
            const nextPosition = values[0]
            if (typeof nextPosition !== "number") {
              return
            }
            setPositionX(nextPosition)
            setArtworkPositionX(nextPosition)
          }}
          onValueCommit={(values) => {
            const nextPosition = values[0]
            if (typeof nextPosition === "number") {
              storeArtworkPositionX(nextPosition)
            }
          }}
          aria-label="Artwork horizontal position"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MoveVertical className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Artwork Y</span>
          <output className="w-10 text-right tabular-nums">
            {formatPosition(positionY)}
          </output>
        </div>
        <Slider
          min={MIN_ARTWORK_POSITION}
          max={MAX_ARTWORK_POSITION}
          step={1}
          value={[positionY]}
          onValueChange={(values) => {
            const nextPosition = values[0]
            if (typeof nextPosition !== "number") {
              return
            }
            setPositionY(nextPosition)
            setArtworkPositionY(nextPosition)
          }}
          onValueCommit={(values) => {
            const nextPosition = values[0]
            if (typeof nextPosition === "number") {
              storeArtworkPositionY(nextPosition)
            }
          }}
          aria-label="Artwork vertical position"
        />
      </div>
    </div>
  )
}
