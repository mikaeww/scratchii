// Every visible interface string, by key, in the language chosen in the settings (English by default).
import { readPreferences } from "../storage/preferences.ts";
import { ENGLISH, type TextKey } from "./language/english.ts";
import { GERMAN } from "./language/german.ts";

export type { TextKey };
export type Language = "en" | "de";

// "System" follows the browser: German when its first language is German, English otherwise.
export function activeLanguage(): Language {
  const chosen = readPreferences().language;
  if (chosen !== "system") return chosen;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

const dictionary: Readonly<Record<TextKey, string>> = activeLanguage() === "de" ? GERMAN : ENGLISH;

export function text(key: TextKey): string {
  return dictionary[key];
}
