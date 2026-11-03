import {
  jsonSetting,
  numberSetting,
  readSetting,
  stringSetting,
  writeSetting,
  type Setting,
} from "@/react-app/lib/local-storage";

const APPEARANCE_PRESETS_VERSION = 1;
export const DEFAULT_BACKGROUND = "#111b16";
export const DEFAULT_FONT_COLOR = "#d2d8cf";
export const DEFAULT_ARTWORK_COLOR = "#6f8f79";
export const DEFAULT_PLAYLIST_WIDTH = 100;
export const MIN_PLAYLIST_WIDTH = 0;
export const MAX_PLAYLIST_WIDTH = 100;
export const DEFAULT_SIDEBAR_WIDTH = 208;
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 400;
// Text size as a percentage of the default.
export const DEFAULT_FONT_SIZE = 100;
export const MIN_FONT_SIZE = 80;
export const MAX_FONT_SIZE = 140;
export const DEFAULT_ARTWORK_POSITION = 0;
export const MIN_ARTWORK_POSITION = -125;
export const MAX_ARTWORK_POSITION = 125;
export const DEFAULT_ARTWORK_SIZE = 100;
export const MIN_ARTWORK_SIZE = 25;
export const MAX_ARTWORK_SIZE = 200;

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
    .replace(/[\u0300-\u036f]/g, "")
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
export const DEFAULT_ARTWORK: ArtworkId = ARTWORK_OPTIONS[0]?.id ?? "";

/** Everything the customization section controls. */
export type AppearanceValues = {
  backgroundColor: string;
  fontColor: string;
  artworkColor: string;
  artwork: ArtworkId;
  artworkSize: number;
  artworkPositionX: number;
  artworkPositionY: number;
  playlistWidth: number;
  sidebarWidth: number;
  fontSize: number;
};

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

const setBackgroundColor = (color: string) => {
  const root = document.documentElement;
  const accentColor = getAccentColor(color);
  root.style.setProperty("--background", color);
  root.style.setProperty("--card", color);
  root.style.setProperty("--sidebar", color);
  root.style.setProperty("--accent", accentColor);
  root.style.setProperty("--sidebar-accent", accentColor);
};

const setFontColor = (color: string) => {
  const root = document.documentElement;
  root.style.setProperty("--foreground", color);
  root.style.setProperty("--card-foreground", color);
  root.style.setProperty("--popover-foreground", color);
  root.style.setProperty("--secondary-foreground", color);
  root.style.setProperty("--accent-foreground", color);
  // Secondary text: the font color, toned down toward the background.
  root.style.setProperty(
    "--muted-foreground",
    `color-mix(in oklch, ${color} 55%, var(--background))`,
  );
  root.style.setProperty("--sidebar-foreground", color);
  root.style.setProperty("--sidebar-accent-foreground", color);
};

const setArtworkColor = (color: string) => {
  document.documentElement.style.setProperty("--artwork-color", color);
};

const setArtwork = (artwork: ArtworkId) => {
  const root = document.documentElement;
  const selectedArtwork = ARTWORK_OPTIONS.find((option) => option.id === artwork);

  if (!selectedArtwork) {
    delete root.dataset.artwork;
    root.style.setProperty("--artwork-mask", "none");
    return;
  }

  root.dataset.artwork = selectedArtwork.id;
  root.style.setProperty("--artwork-mask", `url(${JSON.stringify(selectedArtwork.url)})`);
};

const setArtworkSize = (size: number) => {
  const clampedSize = clamp(size, MIN_ARTWORK_SIZE, MAX_ARTWORK_SIZE);
  document.documentElement.style.setProperty("--artwork-scale", String(clampedSize / 100));
};

const setArtworkPositionX = (position: number) => {
  const clampedPosition = clamp(position, MIN_ARTWORK_POSITION, MAX_ARTWORK_POSITION);
  document.documentElement.style.setProperty("--artwork-position-x", `${clampedPosition}%`);
};

const setArtworkPositionY = (position: number) => {
  const clampedPosition = clamp(position, MIN_ARTWORK_POSITION, MAX_ARTWORK_POSITION);
  document.documentElement.style.setProperty("--artwork-position-y", `${clampedPosition}%`);
};

const setPlaylistWidth = (width: number) => {
  const clampedWidth = clamp(width, MIN_PLAYLIST_WIDTH, MAX_PLAYLIST_WIDTH);
  document.documentElement.style.setProperty("--playlist-pane-width", `${clampedWidth}%`);
};

// Scales all text (see --font-scale in index.css), but not spacing or icons.
const setFontSize = (size: number) => {
  const clampedSize = clamp(size, MIN_FONT_SIZE, MAX_FONT_SIZE);
  document.documentElement.style.setProperty("--font-scale", String(clampedSize / 100));
};

const setSidebarWidth = (width: number) => {
  const clampedWidth = clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
  document.documentElement.style.setProperty("--app-sidebar-width", `${clampedWidth}px`);
};

// ---------- Stored settings ----------

const isHexColor = (value: string): value is string => /^#[\da-f]{6}$/i.test(value);
const isArtworkId = (value: string): value is ArtworkId =>
  ARTWORK_OPTIONS.some((artwork) => artwork.id === value);

const backgroundColorSetting = stringSetting(
  "appearance.backgroundColor",
  DEFAULT_BACKGROUND,
  isHexColor,
);
const fontColorSetting = stringSetting("appearance.fontColor", DEFAULT_FONT_COLOR, isHexColor);
const artworkColorSetting = stringSetting(
  "appearance.artworkColor",
  DEFAULT_ARTWORK_COLOR,
  isHexColor,
);
const artworkSetting = stringSetting<ArtworkId>("appearance.artwork", DEFAULT_ARTWORK, isArtworkId);
const artworkSizeSetting = numberSetting("appearance.artworkSize", DEFAULT_ARTWORK_SIZE, {
  min: MIN_ARTWORK_SIZE,
  max: MAX_ARTWORK_SIZE,
});
const artworkPositionXSetting = numberSetting(
  "appearance.artworkPositionX",
  DEFAULT_ARTWORK_POSITION,
  { min: MIN_ARTWORK_POSITION, max: MAX_ARTWORK_POSITION },
);
const artworkPositionYSetting = numberSetting(
  "appearance.artworkPositionY",
  DEFAULT_ARTWORK_POSITION,
  { min: MIN_ARTWORK_POSITION, max: MAX_ARTWORK_POSITION },
);
const playlistWidthSetting = numberSetting("appearance.playlistWidth", DEFAULT_PLAYLIST_WIDTH, {
  min: MIN_PLAYLIST_WIDTH,
  max: MAX_PLAYLIST_WIDTH,
});
const fontSizeSetting = numberSetting("appearance.fontSize", DEFAULT_FONT_SIZE, {
  min: MIN_FONT_SIZE,
  max: MAX_FONT_SIZE,
});
const sidebarWidthSetting = numberSetting("appearance.sidebarWidth", DEFAULT_SIDEBAR_WIDTH, {
  min: MIN_SIDEBAR_WIDTH,
  max: MAX_SIDEBAR_WIDTH,
});

// Each appearance value, its setting, and how it's applied to the page.
const APPEARANCE: {
  [K in keyof AppearanceValues]: {
    setting: Setting<AppearanceValues[K]>;
    apply: (value: AppearanceValues[K]) => void;
  };
} = {
  backgroundColor: { setting: backgroundColorSetting, apply: setBackgroundColor },
  fontColor: { setting: fontColorSetting, apply: setFontColor },
  artworkColor: { setting: artworkColorSetting, apply: setArtworkColor },
  artwork: { setting: artworkSetting, apply: setArtwork },
  artworkSize: { setting: artworkSizeSetting, apply: setArtworkSize },
  artworkPositionX: { setting: artworkPositionXSetting, apply: setArtworkPositionX },
  artworkPositionY: { setting: artworkPositionYSetting, apply: setArtworkPositionY },
  playlistWidth: { setting: playlistWidthSetting, apply: setPlaylistWidth },
  sidebarWidth: { setting: sidebarWidthSetting, apply: setSidebarWidth },
  fontSize: { setting: fontSizeSetting, apply: setFontSize },
};
const APPEARANCE_KEYS = Object.keys(APPEARANCE) as (keyof AppearanceValues)[];

/** Props shared by the customization controls; the state lives in CustomizationSection. */
export type AppearanceControlProps = {
  appearance: AppearanceValues;
  onChange: (patch: Partial<AppearanceValues>) => void;
};

export const readAppearance = (): AppearanceValues =>
  Object.fromEntries(
    APPEARANCE_KEYS.map((name) => [
      name,
      readSetting(APPEARANCE[name].setting as Setting<unknown>),
    ]),
  ) as AppearanceValues;

/** Sets the CSS variables for the given appearance. */
export const applyAppearance = (appearance: AppearanceValues) => {
  for (const name of APPEARANCE_KEYS) {
    (APPEARANCE[name].apply as (value: unknown) => void)(appearance[name]);
  }
};

export const storeAppearance = (appearance: AppearanceValues) => {
  for (const name of APPEARANCE_KEYS) {
    writeSetting(APPEARANCE[name].setting as Setting<unknown>, appearance[name]);
  }
};

export const matchesAppearance = (preset: AppearancePresetValues, current: AppearanceValues) =>
  PRESET_KEYS.every((key) => preset[key] === current[key]);

// ---------- Presets ----------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeAppearancePreset = (value: unknown): AppearancePreset | null => {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const name = value.name.trim();
  const artwork = typeof value.artwork === "string" ? value.artwork : "";
  if (
    !name ||
    typeof value.backgroundColor !== "string" ||
    typeof value.fontColor !== "string" ||
    typeof value.artworkColor !== "string" ||
    (artwork && !isArtworkId(artwork)) ||
    typeof value.artworkSize !== "number" ||
    typeof value.artworkPositionX !== "number" ||
    typeof value.artworkPositionY !== "number"
  ) {
    return null;
  }

  return {
    name,
    backgroundColor: value.backgroundColor,
    fontColor: value.fontColor,
    artworkColor: value.artworkColor,
    artwork,
    artworkSize: clamp(value.artworkSize, MIN_ARTWORK_SIZE, MAX_ARTWORK_SIZE),
    artworkPositionX: clamp(value.artworkPositionX, MIN_ARTWORK_POSITION, MAX_ARTWORK_POSITION),
    artworkPositionY: clamp(value.artworkPositionY, MIN_ARTWORK_POSITION, MAX_ARTWORK_POSITION),
  };
};

export const appearancePresetsSetting = jsonSetting<AppearancePreset[]>(
  "appearance.presets",
  [],
  (stored) => {
    if (!isRecord(stored) || stored.version !== APPEARANCE_PRESETS_VERSION) return undefined;
    if (!Array.isArray(stored.presets)) return undefined;
    return stored.presets.flatMap((preset) => {
      const normalized = normalizeAppearancePreset(preset);
      return normalized ? [normalized] : [];
    });
  },
  (presets) => ({ version: APPEARANCE_PRESETS_VERSION, presets }),
);
