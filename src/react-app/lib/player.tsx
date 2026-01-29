import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type SmartPlaylist = {
  type: "smart"
  id: "all" | "popular-30" | "popular-90" | "popular-365"
  name: string
  sort: "popular" | "recent"
  days?: number
}

export type CustomPlaylist = {
  type: "custom"
  id: number
  name: string
}

export type ActivePlaylist = SmartPlaylist | CustomPlaylist

type PlayerContextValue = {
  activePlaylist: ActivePlaylist
  setActivePlaylist: (playlist: ActivePlaylist) => void
}

const defaultPlaylist: SmartPlaylist = {
  type: "smart",
  id: "all",
  name: "All Songs",
  sort: "recent",
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [activePlaylist, setActivePlaylist] =
    useState<ActivePlaylist>(defaultPlaylist)

  const value = useMemo(
    () => ({ activePlaylist, setActivePlaylist }),
    [activePlaylist]
  )

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider.")
  }
  return context
}
