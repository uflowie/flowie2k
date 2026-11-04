import { useState } from "react";
import { ClipboardPaste, Copy, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import {
  appearancePresetsSetting,
  matchesAppearance,
  parseAppearancePreset,
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

  // Copies the current look, named after the selected preset (if any), as JSON.
  const handleCopy = async () => {
    const preset: AppearancePreset = {
      name: selectedName || name.trim() || "Shared preset",
      ...pickPresetValues(appearance),
    };
    await navigator.clipboard.writeText(JSON.stringify(preset));
    toast.success(`Copied "${preset.name}" to the clipboard`);
  };

  // Saves and applies a preset pasted from the clipboard, replacing one with the same name.
  const handlePaste = async () => {
    let preset: AppearancePreset | null = null;
    try {
      preset = parseAppearancePreset(JSON.parse(await navigator.clipboard.readText()));
    } catch {
      // Not JSON (or clipboard access denied): handled below.
    }
    if (!preset) {
      toast.error("The clipboard doesn't contain a preset");
      return;
    }

    const { name: presetName, ...values } = preset;
    setPresets([
      ...presets.filter((existing) => getPresetKey(existing.name) !== getPresetKey(presetName)),
      preset,
    ]);
    onApply(values);
    toast.success(`Imported "${presetName}"`);
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
      <SidebarMenuItem>
        <div className="flex gap-1 px-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleCopy()}
            className="h-7 flex-1 justify-start rounded-sm px-2 text-xs hover:bg-sidebar-accent"
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handlePaste()}
            className="h-7 flex-1 justify-start rounded-sm px-2 text-xs hover:bg-sidebar-accent"
          >
            <ClipboardPaste className="size-3.5" />
            Paste
          </Button>
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
