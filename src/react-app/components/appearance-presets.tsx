import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import {
  appearancePresetsSetting,
  matchesAppearance,
  pickPresetValues,
  type AppearancePreset,
  type AppearancePresetValues,
  type AppearanceValues,
} from "@/react-app/lib/appearance";
import { useLocalStorage } from "@/react-app/lib/local-storage";

const getPresetKey = (name: string) => name.trim().toLocaleLowerCase();

type AppearancePresetsProps = {
  appearance: AppearanceValues;
  onApply: (preset: AppearancePresetValues) => void;
};

export function AppearancePresets({ appearance, onApply }: AppearancePresetsProps) {
  const [presets, setPresets] = useLocalStorage(appearancePresetsSetting);
  const [name, setName] = useState("");
  // The selected preset is whichever one matches the current appearance.
  const selectedName = presets.find((preset) => matchesAppearance(preset, appearance))?.name ?? "";

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const nextPreset: AppearancePreset = {
      name: trimmedName,
      ...pickPresetValues(appearance),
    };
    setPresets([
      ...presets.filter((preset) => getPresetKey(preset.name) !== getPresetKey(trimmedName)),
      nextPreset,
    ]);
    setName("");
  };

  const handlePresetChange = (presetName: string) => {
    const selectedPreset = presets.find(
      (preset) => getPresetKey(preset.name) === getPresetKey(presetName),
    );
    if (selectedPreset) {
      const { name: _name, ...values } = selectedPreset;
      onApply(values);
    }
  };

  const handleDelete = () => {
    setPresets(
      presets.filter((preset) => getPresetKey(preset.name) !== getPresetKey(selectedName)),
    );
  };

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
                  event.preventDefault();
                  handleSave();
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
  );
}
