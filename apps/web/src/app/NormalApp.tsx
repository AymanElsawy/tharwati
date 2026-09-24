import App from "./App"
import { LanguageProvider } from "../i18n/LanguageProvider"
import { ThemeProvider } from "../contexts/ThemeContext"

export default function NormalApp() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LanguageProvider>
  )
}
