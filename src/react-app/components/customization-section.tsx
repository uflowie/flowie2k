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
import { ArtworkPicker } from "@/react-app/components/artwork-picker";
import { ArtworkPositionControls } from "@/react-app/components/artwork-position-controls";
import { AppearanceColorControls } from "@/react-app/components/background-color-picker";
import { FontSizeSlider } from "@/react-app/components/font-size-slider";
import { PlaylistWidthSlider } from "@/react-app/components/playlist-width-slider";
import { SidebarWidthSlider } from "@/react-app/components/sidebar-width-slider";
import {
  applyAppearance,
  readAppearance,
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
            <SidebarMenuItem>
              <ArtworkPositionControls {...controlProps} />
            </SidebarMenuItem>
            {/* Layout widths only apply next to a docked sidebar, not on phones. */}
            <SidebarMenuItem className="hidden md:block">
              <SidebarWidthSlider {...controlProps} />
            </SidebarMenuItem>
            <SidebarMenuItem className="hidden md:block">
              <PlaylistWidthSlider {...controlProps} />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <FontSizeSlider {...controlProps} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      ) : null}
    </SidebarGroup>
  );
}
