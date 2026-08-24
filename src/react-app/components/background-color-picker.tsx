import { useState } from "react"

import {
  readStoredArtworkColor,
  readStoredBackgroundColor,
  readStoredFontColor,
  setArtworkColor,
  setBackgroundColor,
  setFontColor,
  storeArtworkColor,
  storeBackgroundColor,
  storeFontColor,
} from "@/react-app/lib/appearance"

type ColorPickerRowProps = {
  id: string
  label: string
  initialColor: () => string
  onColorChange: (color: string) => void
}

function ColorPickerRow({
  id,
  label,
  initialColor,
  onColorChange,
}: ColorPickerRowProps) {
  const [color, setColor] = useState(initialColor)

  const handleColorChange = (nextColor: string) => {
    setColor(nextColor)
    onColorChange(nextColor)
  }

  return (
    <label className="flex h-7 w-full items-center gap-2 rounded-sm p-1.5 text-left text-xs outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <input
        id={id}
        type="color"
        value={color}
        onChange={(event) => handleColorChange(event.target.value)}
        className="size-4 shrink-0 rounded-sm border border-border bg-transparent p-0"
        aria-label={label}
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

export function BackgroundColorPicker() {
  return (
    <ColorPickerRow
      id="background-color"
      label="Background Color"
      initialColor={readStoredBackgroundColor}
      onColorChange={(color) => {
        storeBackgroundColor(color)
        setBackgroundColor(color)
      }}
    />
  )
}

export function FontColorPicker() {
  return (
    <ColorPickerRow
      id="font-color"
      label="Font Color"
      initialColor={readStoredFontColor}
      onColorChange={(color) => {
        storeFontColor(color)
        setFontColor(color)
      }}
    />
  )
}

export function ArtworkColorPicker() {
  return (
    <ColorPickerRow
      id="artwork-color"
      label="Artwork Color"
      initialColor={readStoredArtworkColor}
      onColorChange={(color) => {
        storeArtworkColor(color)
        setArtworkColor(color)
      }}
    />
  )
}
