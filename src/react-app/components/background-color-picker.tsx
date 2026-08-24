import { useState } from "react"
import { Sparkles } from "lucide-react"

import { SidebarMenuItem } from "@/components/ui/sidebar"
import {
  readStoredArtworkColor,
  readStoredBackgroundColor,
  readStoredFontColor,
  setArtworkColor,
  setBackgroundColor,
  setFontColor,
  storeArtworkColor,
  storeBackgroundColor,
  storeFontColor,
} from "@/react-app/lib/appearance"

type ColorPickerRowProps = {
  id: string
  label: string
  color: string
  onColorChange: (color: string) => void
}

function ColorPickerRow({
  id,
  label,
  color,
  onColorChange,
}: ColorPickerRowProps) {
  return (
    <label className="flex h-7 w-full items-center gap-2 rounded-sm p-1.5 text-left text-xs outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <input
        id={id}
        type="color"
        value={color}
        onChange={(event) => onColorChange(event.target.value)}
        className="size-4 shrink-0 rounded-sm border border-border bg-transparent p-0"
        aria-label={label}
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

type AppearanceColors = {
  background: string
  font: string
  artwork: string
}

const readStoredColors = (): AppearanceColors => ({
  background: readStoredBackgroundColor(),
  font: readStoredFontColor(),
  artwork: readStoredArtworkColor(),
})

const randomInteger = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const channelToHex = (channel: number) =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0")

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const normalizedHue = ((hue % 360) + 360) % 360
  const normalizedSaturation = saturation / 100
  const normalizedLightness = lightness / 100
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
  const hueSection = normalizedHue / 60
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1))

  let red = 0
  let green = 0
  let blue = 0

  if (hueSection < 1) {
    red = chroma
    green = secondary
  } else if (hueSection < 2) {
    red = secondary
    green = chroma
  } else if (hueSection < 3) {
    green = chroma
    blue = secondary
  } else if (hueSection < 4) {
    green = secondary
    blue = chroma
  } else if (hueSection < 5) {
    red = secondary
    blue = chroma
  } else {
    red = chroma
    blue = secondary
  }

  const lightnessMatch = normalizedLightness - chroma / 2
  return `#${channelToHex(red + lightnessMatch)}${channelToHex(green + lightnessMatch)}${channelToHex(blue + lightnessMatch)}`
}

const createLuckyColors = (): AppearanceColors => {
  const baseHue = randomInteger(0, 359)
  return {
    background: hslToHex(
      baseHue,
      randomInteger(18, 42),
      randomInteger(7, 15),
    ),
    font: hslToHex(
      baseHue + randomInteger(-15, 15),
      randomInteger(8, 24),
      randomInteger(82, 94),
    ),
    artwork: hslToHex(
      baseHue + randomInteger(40, 160),
      randomInteger(35, 70),
      randomInteger(52, 72),
    ),
  }
}

const applyAndStoreColors = (colors: AppearanceColors) => {
  setBackgroundColor(colors.background)
  setFontColor(colors.font)
  setArtworkColor(colors.artwork)
  storeBackgroundColor(colors.background)
  storeFontColor(colors.font)
  storeArtworkColor(colors.artwork)
}

export function AppearanceColorControls() {
  const [colors, setColors] = useState(readStoredColors)

  const updateColor = (
    colorName: keyof AppearanceColors,
    color: string,
  ) => {
    setColors((currentColors) => ({
      ...currentColors,
      [colorName]: color,
    }))

    if (colorName === "background") {
      setBackgroundColor(color)
      storeBackgroundColor(color)
    } else if (colorName === "font") {
      setFontColor(color)
      storeFontColor(color)
    } else {
      setArtworkColor(color)
      storeArtworkColor(color)
    }
  }

  const handleFeelingLucky = () => {
    const luckyColors = createLuckyColors()
    setColors(luckyColors)
    applyAndStoreColors(luckyColors)
  }

  return (
    <>
      <SidebarMenuItem>
        <ColorPickerRow
          id="background-color"
          label="Background Color"
          color={colors.background}
          onColorChange={(color) => updateColor("background", color)}
        />
      </SidebarMenuItem>
      <SidebarMenuItem>
        <ColorPickerRow
          id="font-color"
          label="Font Color"
          color={colors.font}
          onColorChange={(color) => updateColor("font", color)}
        />
      </SidebarMenuItem>
      <SidebarMenuItem>
        <ColorPickerRow
          id="artwork-color"
          label="Artwork Color"
          color={colors.artwork}
          onColorChange={(color) => updateColor("artwork", color)}
        />
      </SidebarMenuItem>
      <SidebarMenuItem>
        <button
          type="button"
          onClick={handleFeelingLucky}
          className="flex h-7 w-full items-center gap-2 rounded-sm p-1.5 text-left text-xs outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate">I&apos;m Feeling Lucky</span>
        </button>
      </SidebarMenuItem>
    </>
  )
}
