import { useEffect, useState } from "react"

const STORAGE_KEY = "appearance.backgroundColor"
const LEGACY_STORAGE_KEY = "debug.backgroundColor"
const DEFAULT_BACKGROUND = "#111b16"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const getAccentColor = (color: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color.trim())
  if (!match) {
    return color
  }

  const channels = match.slice(1).map((value) => Number.parseInt(value, 16))
  const accentChannels = channels.map((value) => clamp(value + 22, 0, 255))
  return `#${accentChannels
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}

const setBackgroundColor = (color: string) => {
  const root = document.documentElement
  const accentColor = getAccentColor(color)
  root.style.setProperty("--background", color)
  root.style.setProperty("--card", color)
  root.style.setProperty("--sidebar", color)
  root.style.setProperty("--accent", accentColor)
  root.style.setProperty("--sidebar-accent", accentColor)
}

const clearBackgroundColor = () => {
  const root = document.documentElement
  root.style.removeProperty("--background")
  root.style.removeProperty("--card")
  root.style.removeProperty("--sidebar")
  root.style.removeProperty("--accent")
  root.style.removeProperty("--sidebar-accent")
}

const readStoredColor = () => {
  const storedColor =
    window.localStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (storedColor) {
    window.localStorage.setItem(STORAGE_KEY, storedColor)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  return storedColor ?? DEFAULT_BACKGROUND
}

export function BackgroundColorPicker() {
  const [color, setColor] = useState(() => {
    return readStoredColor()
  })

  useEffect(() => {
    const storedColor = readStoredColor()
    if (storedColor) {
      setBackgroundColor(storedColor)
    }
  }, [])

  const handleColorChange = (nextColor: string) => {
    setColor(nextColor)
    window.localStorage.setItem(STORAGE_KEY, nextColor)
    setBackgroundColor(nextColor)
  }

  const handleReset = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    setColor(DEFAULT_BACKGROUND)
    clearBackgroundColor()
  }

  return (
    <div className="flex flex-col gap-2 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(event) => handleColorChange(event.target.value)}
          className="size-7 rounded-sm border border-border bg-transparent p-0"
          aria-label="Background color"
        />
        <input
          type="text"
          value={color}
          onChange={(event) => handleColorChange(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-xs text-foreground"
          aria-label="Background color value"
        />
        <button
          type="button"
          onClick={handleReset}
          className="h-7 rounded-sm px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
