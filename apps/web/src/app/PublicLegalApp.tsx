import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "../contexts/ThemeContext"
import { LanguageProvider } from "../i18n/LanguageProvider"
import { LegalPage } from "../features/legal/LegalPage"

export function PublicLegalRoutes() {
  return (
    <Routes>
      <Route path="/privacy" element={<LegalPage document="privacy" />} />
      <Route path="/terms" element={<LegalPage document="terms" />} />
    </Routes>
  )
}

export default function PublicLegalApp() {
  const requestedLanguage = new URLSearchParams(window.location.search).get(
    "lang"
  )
  return (
    <LanguageProvider
      initialLanguage={
        requestedLanguage === "ar" || requestedLanguage === "en"
          ? requestedLanguage
          : undefined
      }
    >
      <ThemeProvider>
        <BrowserRouter>
          <PublicLegalRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </LanguageProvider>
  )
}
