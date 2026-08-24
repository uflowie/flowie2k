import { useEffect, useState } from "react"
import { Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarMenuItem } from "@/components/ui/sidebar"
import {
  applyAppearancePreset,
  getCurrentAppearance,
  readAppearancePresets,
  storeAppearancePresets,
  APPEARANCE_CHANGE_EVENT,
  type AppearanceChangeSource,
  type AppearancePreset,
} from "@/react-app/lib/appearance"

const getPresetKey = (name: string) => name.trim().toLocaleLowerCase()

export function AppearancePresets() {
  const [presets, setPresets] = useState<AppearancePreset[]>(
    readAppearancePresets,
  )
  const [name, setName] = useState("")
  const [selectedName, setSelectedName] = useState("")

  useEffect(() => {
    const handleAppearanceChange = (event: Event) => {
      const source = (event as CustomEvent<{ source?: AppearanceChangeSource }>).detail
        ?.source
      if (source === "customization") {
        setSelectedName("")
      }
    }

    window.addEventListener(APPEARANCE_CHANGE_EVENT, handleAppearanceChange)
    return () =>
      window.removeEventListener(
        APPEARANCE_CHANGE_EVENT,
        handleAppearanceChange,
      )
  }, [])

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const nextPreset: AppearancePreset = {
      name: trimmedName,
      ...getCurrentAppearance(),
    }
    const nextPresets = [
      ...presets.filter(
        (preset) => getPresetKey(preset.name) !== getPresetKey(trimmedName),
      ),
      nextPreset,
    ]
    setPresets(nextPresets)
    storeAppearancePresets(nextPresets)
    setSelectedName(trimmedName)
    setName("")
  }

  const handlePresetChange = (presetName: string) => {
    setSelectedName(presetName)
    const selectedPreset = presets.find(
      (preset) => getPresetKey(preset.name) === getPresetKey(presetName),
    )
    if (selectedPreset) {
      applyAppearancePreset(selectedPreset)
    }
  }

  const handleDelete = () => {
    const nextPresets = presets.filter(
      (preset) => getPresetKey(preset.name) !== getPresetKey(selectedName),
    )
    setPresets(nextPresets)
    storeAppearancePresets(nextPresets)
    setSelectedName("")
  }

  return (
    <>
      <SidebarMenuItem>
        <div className="rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <select
            value={selectedName}
            onChange={(event) => handlePresetChange(event.target.value)}
            className="h-7 w-full min-w-0 rounded-sm border border-border bg-background px-1.5 text-xs outline-none"
            aria-label="Appearance preset"
          >
            <option value="">Select a preset</option>
            {presets.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <div className="rounded-sm p-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <div className="flex min-w-0 gap-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleSave()
                }
              }}
              placeholder="New preset name"
              aria-label="New appearance preset name"
              className="h-7 min-w-0 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSave}
              disabled={!name.trim()}
              aria-label="Save appearance preset"
              className="size-7 shrink-0"
            >
              <Save className="size-3.5" />
            </Button>
          </div>
        </div>
      </SidebarMenuItem>
      {selectedName ? (
        <SidebarMenuItem>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-7 w-full justify-start rounded-sm px-2 text-xs text-destructive hover:bg-sidebar-accent hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete preset
          </Button>
        </SidebarMenuItem>
      ) : null}
    </>
  )
}
