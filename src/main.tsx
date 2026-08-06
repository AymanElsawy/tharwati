import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./contexts/ThemeContext"
import { LanguageProvider } from "./i18n/LanguageProvider"
import { preloadExchangeRates } from "./services/exchangeRateService"

preloadExchangeRates()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)
