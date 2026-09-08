import { CheckCircle2, X } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"

type Props = {
  message: string | null
  onDismiss: () => void
}

export function AssetToast({ message, onDismiss }: Props) {
  const { t } = useTranslation()
  if (!message) return null

  return (
    <div
      role="status"
      className="fixed bottom-6 end-6 z-[60] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-emerald-800 shadow-xl"
    >
      <CheckCircle2 size={20} className="shrink-0" />
      <p className="text-sm font-semibold">{message}</p>
      <button
        type="button"
        aria-label={t("assets.toast.dismiss")}
        onClick={onDismiss}
        className="ms-2 rounded-lg p-1"
      >
        <X size={16} />
      </button>
    </div>
  )
}
