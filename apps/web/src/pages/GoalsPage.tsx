import { useTranslation } from "../i18n/useTranslation"

export function GoalsPage() {
  const { t } = useTranslation()
  return (
    <section>
      <h2 className="text-3xl font-bold">{t("pages.goals.title")}</h2>
      <p className="mt-2 text-gray-600">
        {t("pages.goals.description")}
      </p>
    </section>
  )
}
