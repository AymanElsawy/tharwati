export type RecoveryLanguage = "en" | "ar"

export function getSafeRecoveryLanguage(): RecoveryLanguage {
  try {
    if (window.localStorage.getItem("tharwati-language") === "ar") return "ar"
  } catch {
    // Recovery UI must remain available when browser storage is unavailable.
  }
  return window.navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en"
}
