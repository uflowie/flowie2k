import { useState } from "react"

import {
  readStoredColor,
  setBackgroundColor,
  storeBackgroundColor,
} from "@/react-app/lib/appearance"

export function BackgroundColorPicker() {
  const [color, setColor] = useState(() => {
    return readStoredColor()
  })

  const handleColorChange = (nextColor: string) => {
    setColor(nextColor)
    storeBackgroundColor(nextColor)
    setBackgroundColor(nextColor)
  }

  return (
    <label className="flex h-8 w-full items-center gap-2 rounded-sm p-1.5 text-left text-xs outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <input
        id="background-color"
        type="color"
        value={color}
        onChange={(event) => handleColorChange(event.target.value)}
        className="size-4 shrink-0 rounded-sm border border-border bg-transparent p-0"
        aria-label="Background color"
      />
      <span className="truncate">Background Color</span>
    </label>
  )
}
