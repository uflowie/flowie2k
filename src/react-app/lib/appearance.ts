import { useEffect } from "react"

const BACKGROUND_STORAGE_KEY = "appearance.backgroundColor"
const BACKGROUND_LEGACY_STORAGE_KEY = "debug.backgroundColor"
const FONT_STORAGE_KEY = "appearance.fontColor"
export const DEFAULT_BACKGROUND = "#111b16"
export const DEFAULT_FONT_COLOR = "#d2d8cf"

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

export const setFontColor = (color: string) => {
  const root = document.documentElement
  root.style.setProperty("--foreground", color)
  root.style.setProperty("--card-foreground", color)
  root.style.setProperty("--sidebar-foreground", color)
}

export const clearBackgroundColor = () => {
  const root = document.documentElement
  root.style.removeProperty("--background")
  root.style.removeProperty("--card")
  root.style.removeProperty("--sidebar")
  root.style.removeProperty("--accent")
  root.style.removeProperty("--sidebar-accent")
}

export const readStoredBackgroundColor = () => {
  const storedColor =
    window.localStorage.getItem(BACKGROUND_STORAGE_KEY) ??
    window.localStorage.getItem(BACKGROUND_LEGACY_STORAGE_KEY)

  if (storedColor) {
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, storedColor)
    window.localStorage.removeItem(BACKGROUND_LEGACY_STORAGE_KEY)
  }

  return storedColor ?? DEFAULT_BACKGROUND
}

export const readStoredFontColor = () => {
  return window.localStorage.getItem(FONT_STORAGE_KEY) ?? DEFAULT_FONT_COLOR
}

export const storeBackgroundColor = (color: string) => {
  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, color)
}

export const storeFontColor = (color: string) => {
  window.localStorage.setItem(FONT_STORAGE_KEY, color)
}

export const clearStoredBackgroundColor = () => {
  window.localStorage.removeItem(BACKGROUND_STORAGE_KEY)
  window.localStorage.removeItem(BACKGROUND_LEGACY_STORAGE_KEY)
}

export function useStoredAppearance() {
  useEffect(() => {
    setBackgroundColor(readStoredBackgroundColor())
    setFontColor(readStoredFontColor())
  }, [])
}
