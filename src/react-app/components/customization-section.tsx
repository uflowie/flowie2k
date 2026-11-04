import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AppearancePresets } from "@/react-app/components/appearance-presets";
import { Slider } from "@/components/ui/slider";
import { ArtworkPicker } from "@/react-app/components/artwork-picker";
import { AppearanceColorControls } from "@/react-app/components/background-color-picker";
import {
  applyAppearance,
  readAppearance,
  SLIDER_KEYS,
  SLIDERS,
  storeAppearance,
  type AppearanceValues,
} from "@/react-app/lib/appearance";
import { booleanSetting, useLocalStorage } from "@/react-app/lib/local-storage";

const customizationOpenSetting = booleanSetting("sidebar.customizationOpen", true);

/**
 * Owns the appearance state shared by all customization controls, so applying a preset
 * updates every control at once. Stays mounted while collapsed so the state survives.
 */
export function CustomizationSection() {
  const [open, setOpen] = useLocalStorage(customizationOpenSetting);
  const [appearance, setAppearance] = useState(readAppearance);

  useEffect(() => {
    applyAppearance(appearance);
    storeAppearance(appearance);
  }, [appearance]);

  const updateAppearance = (patch: Partial<AppearanceValues>) =>
    setAppearance((current) => ({ ...current, ...patch }));
  const controlProps = { appearance, onChange: updateAppearance };

  return (
    <SidebarGroup>
      <SidebarGroupLabel asChild>
        <button
          type="button"
          aria-controls="customization-content"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="w-full justify-between text-left"
        >
          <span>Customization</span>
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </SidebarGroupLabel>
      {open ? (
        <SidebarGroupContent id="customization-content">
          <SidebarMenu>
            <AppearancePresets appearance={appearance} onApply={updateAppearance} />
            <AppearanceColorControls {...controlProps} />
            <SidebarMenuItem>
              <ArtworkPicker {...controlProps} />
            </SidebarMenuItem>
            {SLIDER_KEYS.map((key) => {
              const {
                label,
                ariaLabel = label,
                icon: Icon,
                format,
                desktopOnly,
                ...range
              } = SLIDERS[key];
              return (
                <SidebarMenuItem key={key} className={desktopOnly ? "hidden md:block" : undefined}>
                  <div className="space-y-2 rounded-sm p-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <output className="w-11 text-right tabular-nums">
                        {format(appearance[key])}
                      </output>
                    </div>
                    <Slider
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={[appearance[key]]}
                      onValueChange={([value]) => updateAppearance({ [key]: value })}
                      aria-label={ariaLabel}
                    />
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      ) : null}
    </SidebarGroup>
  );
}
