import { useState } from "react"
import { PanelLeft } from "lucide-react"

import { Slider } from "@/components/ui/slider"
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  readStoredSidebarWidth,
  setSidebarWidth,
  storeSidebarWidth,
} from "@/react-app/lib/appearance"

export function SidebarWidthSlider() {
  const [width, setWidth] = useState(readStoredSidebarWidth)

  return (
    <div className="space-y-2 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <div className="flex items-center gap-2">
        <PanelLeft className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Sidebar width</span>
        <output className="w-11 text-right tabular-nums">{width}px</output>
      </div>
      <Slider
        min={MIN_SIDEBAR_WIDTH}
        max={MAX_SIDEBAR_WIDTH}
        step={4}
        value={[width]}
        onValueChange={(values) => {
          const nextWidth = values[0]
          if (typeof nextWidth !== "number") {
            return
          }
          setWidth(nextWidth)
          setSidebarWidth(nextWidth)
        }}
        onValueCommit={(values) => {
          const nextWidth = values[0]
          if (typeof nextWidth === "number") {
            storeSidebarWidth(nextWidth)
          }
        }}
        aria-label="Sidebar width"
      />
    </div>
  )
}
