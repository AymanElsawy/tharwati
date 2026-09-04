import { useState } from "react"
import { Download, FileText, ShieldAlert, Trash2 } from "lucide-react"
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser"
import { updateCurrentUserFullName } from "@/features/profile/repositories/profile.repository"
import { UserDataExportError, userDataExportService } from "@/features/privacy/services/user-data-export.service"
import { useTranslation } from "@/i18n/useTranslation"

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const [editedFullName, setEditedFullName] = useState<string | null>(null)
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | UserDataExportError["code"]>("idle")

  const fullName = editedFullName ?? user.fullName ?? ""

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setProfileStatus("saving")
    try {
      const savedName = fullName.trim() || null
      await updateCurrentUserFullName(savedName)
      await user.refreshProfile()
      setEditedFullName(savedName ?? "")
      setProfileStatus("saved")
    } catch {
      setProfileStatus("error")
    }
  }

  async function downloadData() {
    setExportStatus("loading")
    try {
      const { blob, filename } = await userDataExportService.downloadExport()
      triggerDownload(blob, filename)
      setExportStatus("success")
    } catch (error) {
      setExportStatus(error instanceof UserDataExportError ? error.code : "unavailable")
    }
  }

  const exportMessage = exportStatus === "success" ? t("settings.export.success")
    : exportStatus === "rate_limited" ? t("settings.export.rateLimited")
      : exportStatus === "too_large" ? t("settings.export.tooLarge")
        : exportStatus === "authentication_required" ? t("settings.export.authExpired")
          : exportStatus === "unavailable" ? t("settings.export.error") : null

  return <section className="tharwati-page-stack max-w-3xl">
    <header className="tharwati-page-header"><p className="tharwati-eyebrow">{t("settings.eyebrow")}</p><h1 className="tharwati-page-title mt-2">{t("settings.title")}</h1><p className="tharwati-page-description">{t("settings.description")}</p></header>
    <article className="tharwati-card p-5 sm:p-6"><h2 className="text-lg font-bold">{t("settings.profile.title")}</h2><form className="mt-5 space-y-4" onSubmit={saveProfile}><label className="block text-sm font-semibold">{t("settings.profile.fullName")}<input value={fullName} onChange={(event) => setEditedFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" autoComplete="name" /></label><div><p className="text-sm font-semibold">{t("settings.profile.email")}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]" dir="ltr">{user.email}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("settings.profile.emailComingSoon")}</p></div>{profileStatus === "error" ? <p role="alert" className="text-sm text-red-600">{t("settings.profile.error")}</p> : null}{profileStatus === "saved" ? <p role="status" className="text-sm text-emerald-700">{t("settings.profile.saved")}</p> : null}<button type="submit" disabled={profileStatus === "saving"} className="tharwati-button-primary min-h-11">{profileStatus === "saving" ? t("settings.profile.saving") : t("settings.profile.save")}</button></form></article>
    <article className="tharwati-card p-5 sm:p-6"><div className="flex gap-3"><Download className="mt-0.5 size-5 shrink-0 text-[var(--color-primary)]" /><div><h2 className="text-lg font-bold">{t("settings.privacy.title")}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("settings.export.description")}</p></div></div><button type="button" onClick={() => void downloadData()} disabled={exportStatus === "loading"} className="tharwati-button-secondary mt-5 min-h-11">{exportStatus === "loading" ? t("settings.export.loading") : t("settings.export.action")}</button>{exportMessage ? <p role="status" className="mt-3 text-sm text-[var(--color-text-secondary)]">{exportMessage}</p> : null}<div className="mt-6 border-t border-[var(--border-subtle)] pt-4"><p className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4" />{t("settings.legal.title")}</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("settings.legal.comingSoon")}</p></div></article>
    <article className="tharwati-card border border-red-200 p-5 sm:p-6"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-700" /><div><h2 className="text-lg font-bold text-red-800">{t("settings.delete.title")}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("settings.delete.description")}</p></div></div><button type="button" disabled className="mt-5 flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="size-4" />{t("settings.delete.action")}</button></article>
  </section>
}
