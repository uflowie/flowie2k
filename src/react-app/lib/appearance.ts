import {
  ALargeSmall,
  Columns3,
  MoveHorizontal,
  MoveVertical,
  PanelLeft,
  Scaling,
  type LucideIcon,
} from "lucide-react";

import {
  jsonSetting,
  numberSetting,
  readSetting,
  stringSetting,
  writeSetting,
  type Setting,
} from "@/react-app/lib/local-storage";

const APPEARANCE_PRESETS_VERSION = 1;

const artworkAssets = import.meta.glob("../assets/artwork/*.{avif,gif,jpeg,jpg,png,svg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const getArtworkFileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const getArtworkLabel = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

const getArtworkId = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const ARTWORK_OPTIONS = Object.entries(artworkAssets)
  .map(([path, url]) => {
    const fileName = getArtworkFileName(path);
    return {
      id: getArtworkId(fileName),
      label: getArtworkLabel(fileName),
      url,
    };
  })
  .filter((artwork) => artwork.id && artwork.label)
  .sort((left, right) => left.label.localeCompare(right.label));

export type ArtworkId = string;

// ---------- Sliders ----------

/** A numeric setting shown as a slider and applied to the page as one CSS variable. */
type SliderSetting = {
  label: string;
  /** Defaults to the label. */
  ariaLabel?: string;
  icon: LucideIcon;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  /** The value as shown next to the label. */
  format: (value: number) => string;
  cssVar: string;
  toCss: (value: number) => string;
  /** Layout widths only apply next to a docked sidebar, not on phones. */
  desktopOnly?: boolean;
};

const percent = (value: number) => `${value}%`;
const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
const pixels = (value: number) => `${value}px`;
const scale = (value: number) => String(value / 100);

// Keeps the keys while typing every entry as a SliderSetting.
const defineSliders = <K extends string>(sliders: Record<K, SliderSetting>) => sliders;

/** In the order they appear in the sidebar. */
export const SLIDERS = defineSliders({
  artworkSize: {
    label: "Artwork size",
    icon: Scaling,
    defaultValue: 100,
    min: 25,
    max: 200,
    step: 1,
    format: percent,
    cssVar: "--artwork-scale",
    toCss: scale,
  },
  artworkPositionX: {
    label: "Artwork X",
    ariaLabel: "Artwork horizontal position",
    icon: MoveHorizontal,
    defaultValue: 0,
    min: -125,
    max: 125,
    step: 1,
    format: signedPercent,
    cssVar: "--artwork-position-x",
    toCss: percent,
  },
  artworkPositionY: {
    label: "Artwork Y",
    ariaLabel: "Artwork vertical position",
    icon: MoveVertical,
    defaultValue: 0,
    min: -125,
    max: 125,
    step: 1,
    format: signedPercent,
    cssVar: "--artwork-position-y",
    toCss: percent,
  },
  sidebarWidth: {
    label: "Sidebar width",
    icon: PanelLeft,
    defaultValue: 208,
    min: 160,
    max: 400,
    step: 4,
    format: pixels,
    cssVar: "--app-sidebar-width",
    toCss: pixels,
    desktopOnly: true,
  },
  playlistWidth: {
    label: "Playlist width",
    icon: Columns3,
    defaultValue: 100,
    min: 0,
    max: 100,
    step: 1,
    format: percent,
    cssVar: "--playlist-pane-width",
    toCss: percent,
    desktopOnly: true,
  },
  // Scales all text (see --font-scale in index.css), but not spacing or icons.
  fontSize: {
    label: "Font size",
    icon: ALargeSmall,
    defaultValue: 100,
    min: 80,
    max: 140,
    step: 5,
    format: percent,
    cssVar: "--font-scale",
    toCss: scale,
  },
});

type SliderKey = keyof typeof SLIDERS;
export const SLIDER_KEYS = Object.keys(SLIDERS) as SliderKey[];

// ---------- Values and how they're stored ----------

/** Everything the customization section controls. */
export type AppearanceValues = {
  backgroundColor: string;
  fontColor: string;
  artworkColor: string;
  artwork: ArtworkId;
} & Record<SliderKey, number>;

const isHexColor = (value: string): value is string => /^#[\da-f]{6}$/i.test(value);
// An empty artwork means none, which is all there is when no artwork files exist.
const isArtworkId = (value: string): value is ArtworkId =>
  value === "" || ARTWORK_OPTIONS.some((artwork) => artwork.id === value);

const SETTINGS = {
  backgroundColor: stringSetting("appearance.backgroundColor", "#111b16", isHexColor),
  fontColor: stringSetting("appearance.fontColor", "#d2d8cf", isHexColor),
  artworkColor: stringSetting("appearance.artworkColor", "#6f8f79", isHexColor),
  artwork: stringSetting("appearance.artwork", ARTWORK_OPTIONS[0]?.id ?? "", isArtworkId),
  ...(Object.fromEntries(
    SLIDER_KEYS.map((key) => [
      key,
      numberSetting(`appearance.${key}`, SLIDERS[key].defaultValue, SLIDERS[key]),
    ]),
  ) as Record<SliderKey, Setting<number>>),
} satisfies { [K in keyof AppearanceValues]: Setting<AppearanceValues[K]> };

const APPEARANCE_KEYS = Object.keys(SETTINGS) as (keyof AppearanceValues)[];

/** Props shared by the customization controls; the state lives in CustomizationSection. */
export type AppearanceControlProps = {
  appearance: AppearanceValues;
  onChange: (patch: Partial<AppearanceValues>) => void;
};

export const readAppearance = (): AppearanceValues =>
  Object.fromEntries(
    APPEARANCE_KEYS.map((key) => [key, readSetting(SETTINGS[key] as Setting<unknown>)]),
  ) as AppearanceValues;

export const storeAppearance = (appearance: AppearanceValues) => {
  for (const key of APPEARANCE_KEYS) {
    writeSetting(SETTINGS[key] as Setting<unknown>, appearance[key]);
  }
};

// ---------- Applying to the page ----------

const setVar = (name: string, value: string) =>
  document.documentElement.style.setProperty(name, value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getAccentColor = (color: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color.trim());
  if (!match) {
    return color;
  }

  const channels = match.slice(1).map((value) => Number.parseInt(value, 16));
  const accentChannels = channels.map((value) => clamp(value + 22, 0, 255));
  return `#${accentChannels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

/** Sets the CSS variables for the given appearance. */
export const applyAppearance = (appearance: AppearanceValues) => {
  const { backgroundColor, fontColor } = appearance;
  const accentColor = getAccentColor(backgroundColor);
  for (const name of ["--background", "--card", "--sidebar"]) setVar(name, backgroundColor);
  for (const name of ["--accent", "--sidebar-accent"]) setVar(name, accentColor);

  for (const name of [
    "--foreground",
    "--card-foreground",
    "--popover-foreground",
    "--secondary-foreground",
    "--accent-foreground",
    "--sidebar-foreground",
    "--sidebar-accent-foreground",
  ]) {
    setVar(name, fontColor);
  }
  // Secondary text: the font color, toned down toward the background.
  setVar("--muted-foreground", `color-mix(in oklch, ${fontColor} 55%, var(--background))`);

  setVar("--artwork-color", appearance.artworkColor);
  const artwork = ARTWORK_OPTIONS.find((option) => option.id === appearance.artwork);
  if (artwork) {
    document.documentElement.dataset.artwork = artwork.id;
    setVar("--artwork-mask", `url(${JSON.stringify(artwork.url)})`);
  } else {
    delete document.documentElement.dataset.artwork;
    setVar("--artwork-mask", "none");
  }

  for (const key of SLIDER_KEYS) {
    setVar(SLIDERS[key].cssVar, SLIDERS[key].toCss(appearance[key]));
  }
};

// ---------- Presets ----------

/** Presets cover the look (colors and artwork), not the layout widths. */
const PRESET_KEYS = [
  "backgroundColor",
  "fontColor",
  "artworkColor",
  "artwork",
  "artworkSize",
  "artworkPositionX",
  "artworkPositionY",
] as const;
export type AppearancePresetValues = Pick<AppearanceValues, (typeof PRESET_KEYS)[number]>;

export type AppearancePreset = AppearancePresetValues & {
  name: string;
};

export const pickPresetValues = (appearance: AppearanceValues): AppearancePresetValues =>
  Object.fromEntries(PRESET_KEYS.map((key) => [key, appearance[key]])) as AppearancePresetValues;

export const matchesAppearance = (preset: AppearancePresetValues, current: AppearanceValues) =>
  PRESET_KEYS.every((key) => preset[key] === current[key]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates a stored or pasted preset with the same rules as the stored settings; null when it isn't one. */
export const parseAppearancePreset = (value: unknown): AppearancePreset | null => {
  const name = isRecord(value) && typeof value.name === "string" ? value.name.trim() : "";
  if (!isRecord(value) || !name) {
    return null;
  }

  const preset: Record<string, unknown> = { name };
  for (const key of PRESET_KEYS) {
    const raw = value[key];
    const parsed =
      typeof raw === "string" || typeof raw === "number"
        ? SETTINGS[key].parse(String(raw))
        : undefined;
    if (parsed === undefined) {
      return null;
    }
    preset[key] = parsed;
  }
  return preset as AppearancePreset;
};

export const appearancePresetsSetting = jsonSetting<AppearancePreset[]>(
  "appearance.presets",
  [],
  (stored) => {
    if (!isRecord(stored) || stored.version !== APPEARANCE_PRESETS_VERSION) return undefined;
    if (!Array.isArray(stored.presets)) return undefined;
    return stored.presets.flatMap((preset) => {
      const normalized = parseAppearancePreset(preset);
      return normalized ? [normalized] : [];
    });
  },
  (presets) => ({ version: APPEARANCE_PRESETS_VERSION, presets }),
);
