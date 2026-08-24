const BACKGROUND_STORAGE_KEY = "appearance.backgroundColor"
const BACKGROUND_LEGACY_STORAGE_KEY = "debug.backgroundColor"
const FONT_STORAGE_KEY = "appearance.fontColor"
const ARTWORK_COLOR_STORAGE_KEY = "appearance.artworkColor"
const ARTWORK_STORAGE_KEY = "appearance.artwork"
const ARTWORK_SIZE_STORAGE_KEY = "appearance.artworkSize"
const ARTWORK_X_STORAGE_KEY = "appearance.artworkPositionX"
const ARTWORK_Y_STORAGE_KEY = "appearance.artworkPositionY"
const PLAYLIST_WIDTH_STORAGE_KEY = "appearance.playlistWidth"
const SIDEBAR_WIDTH_STORAGE_KEY = "appearance.sidebarWidth"
export const DEFAULT_BACKGROUND = "#111b16"
export const DEFAULT_FONT_COLOR = "#d2d8cf"
export const DEFAULT_ARTWORK_COLOR = "#6f8f79"
export const DEFAULT_PLAYLIST_WIDTH = 100
export const MIN_PLAYLIST_WIDTH = 0
export const MAX_PLAYLIST_WIDTH = 100
export const DEFAULT_SIDEBAR_WIDTH = 208
export const MIN_SIDEBAR_WIDTH = 160
export const MAX_SIDEBAR_WIDTH = 400
export const DEFAULT_ARTWORK_POSITION = 0
export const MIN_ARTWORK_POSITION = -125
export const MAX_ARTWORK_POSITION = 125
export const DEFAULT_ARTWORK_SIZE = 100
export const MIN_ARTWORK_SIZE = 25
export const MAX_ARTWORK_SIZE = 200

const artworkAssets = import.meta.glob(
  "../assets/artwork/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", query: "?url" },
) as Record<string, string>

const getArtworkFileName = (path: string) =>
  path.slice(path.lastIndexOf("/") + 1)

const getArtworkLabel = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim()

const getArtworkId = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const ARTWORK_OPTIONS = Object.entries(artworkAssets)
  .map(([path, url]) => {
    const fileName = getArtworkFileName(path)
    return {
      id: getArtworkId(fileName),
      label: getArtworkLabel(fileName),
      url,
    }
  })
  .filter((artwork) => artwork.id && artwork.label)
  .sort((left, right) => left.label.localeCompare(right.label))

export type ArtworkId = string
export const DEFAULT_ARTWORK: ArtworkId = ARTWORK_OPTIONS[0]?.id ?? ""

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
  root.style.setProperty("--popover-foreground", color)
  root.style.setProperty("--secondary-foreground", color)
  root.style.setProperty("--accent-foreground", color)
  root.style.setProperty("--muted-foreground", color)
  root.style.setProperty("--sidebar-foreground", color)
  root.style.setProperty("--sidebar-accent-foreground", color)
}

export const setArtworkColor = (color: string) => {
  document.documentElement.style.setProperty("--artwork-color", color)
}

export const setArtwork = (artwork: ArtworkId) => {
  const root = document.documentElement
  const selectedArtwork = ARTWORK_OPTIONS.find((option) => option.id === artwork)

  if (!selectedArtwork) {
    delete root.dataset.artwork
    root.style.setProperty("--artwork-mask", "none")
    return
  }

  root.dataset.artwork = selectedArtwork.id
  root.style.setProperty(
    "--artwork-mask",
    `url(${JSON.stringify(selectedArtwork.url)})`,
  )
}

export const setArtworkSize = (size: number) => {
  const clampedSize = clamp(size, MIN_ARTWORK_SIZE, MAX_ARTWORK_SIZE)
  document.documentElement.style.setProperty(
    "--artwork-scale",
    String(clampedSize / 100),
  )
}

export const setArtworkPositionX = (position: number) => {
  const clampedPosition = clamp(
    position,
    MIN_ARTWORK_POSITION,
    MAX_ARTWORK_POSITION,
  )
  document.documentElement.style.setProperty(
    "--artwork-position-x",
    `${clampedPosition}%`,
  )
}

export const setArtworkPositionY = (position: number) => {
  const clampedPosition = clamp(
    position,
    MIN_ARTWORK_POSITION,
    MAX_ARTWORK_POSITION,
  )
  document.documentElement.style.setProperty(
    "--artwork-position-y",
    `${clampedPosition}%`,
  )
}

export const setPlaylistWidth = (width: number) => {
  const clampedWidth = clamp(
    width,
    MIN_PLAYLIST_WIDTH,
    MAX_PLAYLIST_WIDTH,
  )
  document.documentElement.style.setProperty(
    "--playlist-pane-width",
    `${clampedWidth}%`,
  )
}

export const setSidebarWidth = (width: number) => {
  const clampedWidth = clamp(
    width,
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH,
  )
  document.documentElement.style.setProperty(
    "--app-sidebar-width",
    `${clampedWidth}px`,
  )
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

export const readStoredArtworkColor = () => {
  return (
    window.localStorage.getItem(ARTWORK_COLOR_STORAGE_KEY) ??
    DEFAULT_ARTWORK_COLOR
  )
}

export const readStoredArtwork = (): ArtworkId => {
  const storedArtwork = window.localStorage.getItem(ARTWORK_STORAGE_KEY)
  return ARTWORK_OPTIONS.some((artwork) => artwork.id === storedArtwork)
    ? (storedArtwork ?? DEFAULT_ARTWORK)
    : DEFAULT_ARTWORK
}

export const readStoredArtworkSize = () => {
  const storedValue = window.localStorage.getItem(ARTWORK_SIZE_STORAGE_KEY)
  const storedSize = Number(storedValue)
  return storedValue !== null && Number.isFinite(storedSize)
    ? clamp(storedSize, MIN_ARTWORK_SIZE, MAX_ARTWORK_SIZE)
    : DEFAULT_ARTWORK_SIZE
}

const readStoredArtworkPosition = (storageKey: string) => {
  const storedValue = window.localStorage.getItem(storageKey)
  const storedPosition = Number(storedValue)
  return storedValue !== null && Number.isFinite(storedPosition)
    ? clamp(storedPosition, MIN_ARTWORK_POSITION, MAX_ARTWORK_POSITION)
    : DEFAULT_ARTWORK_POSITION
}

export const readStoredArtworkPositionX = () =>
  readStoredArtworkPosition(ARTWORK_X_STORAGE_KEY)

export const readStoredArtworkPositionY = () =>
  readStoredArtworkPosition(ARTWORK_Y_STORAGE_KEY)

export const readStoredPlaylistWidth = () => {
  const storedValue = window.localStorage.getItem(PLAYLIST_WIDTH_STORAGE_KEY)
  const storedWidth = Number(storedValue)
  return storedValue !== null && Number.isFinite(storedWidth)
    ? clamp(storedWidth, MIN_PLAYLIST_WIDTH, MAX_PLAYLIST_WIDTH)
    : DEFAULT_PLAYLIST_WIDTH
}

export const readStoredSidebarWidth = () => {
  const storedValue = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
  const storedWidth = Number(storedValue)
  return storedValue !== null && Number.isFinite(storedWidth)
    ? clamp(storedWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)
    : DEFAULT_SIDEBAR_WIDTH
}

export const storeBackgroundColor = (color: string) => {
  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, color)
}

export const storeFontColor = (color: string) => {
  window.localStorage.setItem(FONT_STORAGE_KEY, color)
}

export const storeArtworkColor = (color: string) => {
  window.localStorage.setItem(ARTWORK_COLOR_STORAGE_KEY, color)
}

export const storeArtwork = (artwork: ArtworkId) => {
  if (artwork) {
    window.localStorage.setItem(ARTWORK_STORAGE_KEY, artwork)
  } else {
    window.localStorage.removeItem(ARTWORK_STORAGE_KEY)
  }
}

export const storeArtworkSize = (size: number) => {
  window.localStorage.setItem(ARTWORK_SIZE_STORAGE_KEY, String(size))
}

export const storeArtworkPositionX = (position: number) => {
  window.localStorage.setItem(ARTWORK_X_STORAGE_KEY, String(position))
}

export const storeArtworkPositionY = (position: number) => {
  window.localStorage.setItem(ARTWORK_Y_STORAGE_KEY, String(position))
}

export const storePlaylistWidth = (width: number) => {
  window.localStorage.setItem(PLAYLIST_WIDTH_STORAGE_KEY, String(width))
}

export const storeSidebarWidth = (width: number) => {
  window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
}

export const clearStoredBackgroundColor = () => {
  window.localStorage.removeItem(BACKGROUND_STORAGE_KEY)
  window.localStorage.removeItem(BACKGROUND_LEGACY_STORAGE_KEY)
}

export const applyStoredAppearance = () => {
  setBackgroundColor(readStoredBackgroundColor())
  setFontColor(readStoredFontColor())
  setArtworkColor(readStoredArtworkColor())
  setArtwork(readStoredArtwork())
  setArtworkSize(readStoredArtworkSize())
  setArtworkPositionX(readStoredArtworkPositionX())
  setArtworkPositionY(readStoredArtworkPositionY())
  setPlaylistWidth(readStoredPlaylistWidth())
  setSidebarWidth(readStoredSidebarWidth())
}
