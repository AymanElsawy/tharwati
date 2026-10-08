import legalCopy from "../../../../../docs/legal-copy.json"
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher"
import { useTranslation } from "@/i18n/useTranslation"
import { LegalLinks } from "./LegalLinks"

export function LegalPage({ document }: { document: "privacy" | "terms" }) {
  const { language, direction } = useTranslation()
  const copy = legalCopy.documents[document][language]
  return (
    <main
      lang={language}
      dir={direction}
      className="min-h-screen bg-[var(--color-background)] px-4 py-12 text-start text-[var(--color-text-primary)] sm:px-6"
    >
      <article className="tharwati-card mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold sm:text-3xl">{copy.title}</h1>
          <LanguageSwitcher />
        </header>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {copy.updatedLabel}{" "}
          <time dateTime={legalCopy.lastUpdatedAt}>{copy.updatedDate}</time>
        </p>
        {copy.blocks.map((block, index) => {
          if (/^[0-9٠-٩]+\./u.test(block))
            return (
              <h2 key={index} className="pt-4 text-lg font-bold">
                {block}
              </h2>
            )
          if (block.startsWith("- "))
            return (
              <ul key={index} className="list-disc space-y-2 ps-6 leading-8">
                {block.split("\n").map((item) => (
                  <li key={item}>{item.slice(2)}</li>
                ))}
              </ul>
            )
          if (block === "tharwatiwealth@gmail.com")
            return (
              <p key={index}>
                <a
                  href={`mailto:${block}`}
                  dir="ltr"
                  className="break-all text-[var(--color-primary)] underline underline-offset-4"
                >
                  {block}
                </a>
              </p>
            )
          return (
            <p
              key={index}
              className="leading-8 text-[var(--color-text-secondary)]"
            >
              {block}
            </p>
          )
        })}
        <footer className="border-t border-[var(--color-border)] pt-4">
          <LegalLinks />
        </footer>
      </article>
    </main>
  )
}
