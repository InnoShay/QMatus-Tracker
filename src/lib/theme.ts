export const THEME_COOKIE = "qm-theme";
export type ThemePreference = "system" | "light" | "dark";

export function parseTheme(value: string | undefined | null): ThemePreference {
  // Dark is the product's main theme: used until someone chooses otherwise.
  return value === "light" || value === "system" ? value : "dark";
}
