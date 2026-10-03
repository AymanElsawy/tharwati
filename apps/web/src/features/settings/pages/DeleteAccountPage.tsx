import { Link } from "react-router-dom"

import { LanguageSwitcher } from "@/i18n/LanguageSwitcher"
import { useTranslation } from "@/i18n/useTranslation"

export function DeleteAccountPage({ signedIn }: { signedIn: boolean }) {
  const { t, language, direction } = useTranslation()

  return (
    <main
      lang={language}
      dir={direction}
      className="min-h-screen bg-[var(--color-background)] px-4 py-12 text-start text-[var(--color-text-primary)] sm:px-6"
    >
      <article className="tharwati-card mx-auto max-w-xl space-y-6 p-6 sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <p className="text-lg font-bold">{t("settings.deletePage.brand")}</p>
          <LanguageSwitcher />
        </header>
        <div>
          <h1 className="text-2xl font-bold">
            {t("settings.deletePage.title")}
          </h1>
          <p className="mt-3 leading-7 text-[var(--color-text-secondary)]">
            {t("settings.deletePage.description")}
          </p>
        </div>
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 leading-7 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {t("settings.delete.permanentWarning")}
        </p>
        <p className="leading-7 text-[var(--color-text-secondary)]">
          {t("settings.deletePage.instructions")}
        </p>
        <Link
          to={signedIn ? "/settings" : "/login"}
          className="tharwati-button-primary inline-flex min-h-11 items-center justify-center"
        >
          {t(
            signedIn
              ? "settings.deletePage.openSettings"
              : "settings.deletePage.signIn"
          )}
        </Link>
      </article>
    </main>
  )
}
