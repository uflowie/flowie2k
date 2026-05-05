import { useEffect } from "react"

const STORAGE_KEY = "appearance.backgroundColor"
const LEGACY_STORAGE_KEY = "debug.backgroundColor"
export const DEFAULT_BACKGROUND = "#111b16"

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

export const setBackgroundColor = (color: string) => {
  const root = document.documentElement
  const accentColor = getAccentColor(color)
  root.style.setProperty("--background", color)
  root.style.setProperty("--card", color)
  root.style.setProperty("--sidebar", color)
  root.style.setProperty("--accent", accentColor)
  root.style.setProperty("--sidebar-accent", accentColor)
}

export const clearBackgroundColor = () => {
  const root = document.documentElement
  root.style.removeProperty("--background")
  root.style.removeProperty("--card")
  root.style.removeProperty("--sidebar")
  root.style.removeProperty("--accent")
  root.style.removeProperty("--sidebar-accent")
}

export const readStoredColor = () => {
  const storedColor =
    window.localStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (storedColor) {
    window.localStorage.setItem(STORAGE_KEY, storedColor)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  return storedColor ?? DEFAULT_BACKGROUND
}

export const storeBackgroundColor = (color: string) => {
  window.localStorage.setItem(STORAGE_KEY, color)
}

export const clearStoredBackgroundColor = () => {
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function useStoredBackgroundColor() {
  useEffect(() => {
    const storedColor = readStoredColor()
    if (storedColor) {
      setBackgroundColor(storedColor)
    }
  }, [])
}
