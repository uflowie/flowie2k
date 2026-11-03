import { useState } from "react";

/** A value persisted in localStorage under `key`, with a default for missing or invalid data. */
export type Setting<T> = {
  key: string;
  defaultValue: T;
  /** Turns the stored string into a value; returns undefined for anything invalid. */
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
};

export const stringSetting = <T extends string>(
  key: string,
  defaultValue: T,
  isValid?: (value: string) => value is T,
): Setting<T> => ({
  key,
  defaultValue,
  parse: (raw) => (!isValid || isValid(raw) ? (raw as T) : undefined),
  serialize: (value) => value,
});

export const booleanSetting = (key: string, defaultValue: boolean): Setting<boolean> => ({
  key,
  defaultValue,
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : undefined),
  serialize: String,
});

/** A number, clamped to `range` when one is given. */
export const numberSetting = (
  key: string,
  defaultValue: number,
  range?: { min: number; max: number },
): Setting<number> => ({
  key,
  defaultValue,
  parse: (raw) => {
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return undefined;
    return range ? Math.min(Math.max(value, range.min), range.max) : value;
  },
  serialize: String,
});

/** Structured data stored as JSON; `decode` validates what was stored. */
export const jsonSetting = <T>(
  key: string,
  defaultValue: T,
  decode: (value: unknown) => T | undefined,
  encode: (value: T) => unknown = (value) => value,
): Setting<T> => ({
  key,
  defaultValue,
  parse: (raw) => {
    try {
      return decode(JSON.parse(raw));
    } catch {
      return undefined;
    }
  },
  serialize: (value) => JSON.stringify(encode(value)),
});

export function readSetting<T>(setting: Setting<T>): T {
  const raw = window.localStorage.getItem(setting.key);
  return raw === null ? setting.defaultValue : (setting.parse(raw) ?? setting.defaultValue);
}

export function writeSetting<T>(setting: Setting<T>, value: T) {
  window.localStorage.setItem(setting.key, setting.serialize(value));
}

/** `useState` that starts from the stored value and saves every update. */
export function useLocalStorage<T>(setting: Setting<T>) {
  const [value, setValue] = useState(() => readSetting(setting));
  const update = (next: T) => {
    setValue(next);
    writeSetting(setting, next);
  };
  return [value, update] as const;
}
