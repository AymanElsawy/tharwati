import { useTranslation } from "../i18n/useTranslation"

export function PortfolioPage() {
  const { t } = useTranslation()
  return (
    <section>
      <h2 className="text-3xl font-bold">{t("pages.portfolio.title")}</h2>
      <p className="mt-2 text-gray-600">
        {t("pages.portfolio.description")}
      </p>
    </section>
  )
}
