import { getSafeRecoveryLanguage } from "./recovery-language"

export type RecoveryCategory =
  | "startup"
  | "connection"
  | "account"
  | "unexpected"

const copy = {
  en: {
    brand: "Tharwati",
    startup: "Startup unavailable",
    connection: "Connection unavailable",
    account: "Account unavailable",
    unexpected: "Unexpected application error",
    starting: "Starting Tharwati",
    message: "Your data and session are safe. Please try again.",
    retry: "Retry",
    reload: "Reload",
    signOut: "Sign out",
  },
  ar: {
    brand: "ثروتي",
    startup: "تعذر بدء التطبيق",
    connection: "الاتصال غير متاح",
    account: "الحساب غير متاح",
    unexpected: "حدث خطأ غير متوقع في التطبيق",
    starting: "جارٍ بدء ثروتي",
    message: "بياناتك وجلستك محفوظتان. يرجى المحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
    reload: "إعادة التحميل",
    signOut: "تسجيل الخروج",
  },
} as const

export function GlobalRecoveryScreen({
  category,
  action = "retry",
  onRetry,
  onSignOut,
  loading = false,
}: {
  category: RecoveryCategory
  action?: "retry" | "reload"
  onRetry?: () => void
  onSignOut?: () => void
  loading?: boolean
}) {
  const language = getSafeRecoveryLanguage()
  const c = copy[language]

  return (
    <main
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      className="flex min-h-screen items-center justify-center bg-[#071c17] px-4 text-white"
    >
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-8 text-center shadow-2xl">
        <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-[#c9a96b]">
          <img
            src="/tharwati-logo-light.png"
            alt={c.brand}
            className="size-full object-contain"
            onError={(event) => {
              event.currentTarget.hidden = true
              event.currentTarget.nextElementSibling?.removeAttribute("hidden")
            }}
          />
          <span
            aria-hidden="true"
            hidden
            className="text-2xl font-bold text-[#071c17]"
          >
            ث
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold text-[#c9a96b]">{c.brand}</p>
        <h1 className="mt-3 text-2xl font-bold">
          {loading ? c.starting : c[category]}
        </h1>
        {loading ? (
          <div
            role="status"
            className="mx-auto mt-7 size-6 animate-spin rounded-full border-2 border-white/30 border-t-[#c9a96b]"
          />
        ) : (
          <p className="mt-3 text-sm leading-6 text-white/75">{c.message}</p>
        )}
        {!loading ? (
          <div className="mt-7 grid gap-3">
            {onRetry ? (
              <button
                type="button"
                className="min-h-11 rounded-xl bg-[#c9a96b] px-4 font-semibold text-[#071c17]"
                onClick={onRetry}
              >
                {action === "reload" ? c.reload : c.retry}
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                className="min-h-11 rounded-xl border border-white/25 px-4 font-semibold"
                onClick={onSignOut}
              >
                {c.signOut}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
