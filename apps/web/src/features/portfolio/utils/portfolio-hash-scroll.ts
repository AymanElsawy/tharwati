const portfolioHashTargets = new Set([
  "portfolio-concentration",
  "portfolio-holdings-title",
])

/** Scroll after the requested section exists, including after an async load. */
export function scrollPortfolioHashWhenReady(
  hash: string,
  isReady: boolean,
  root: Pick<Document, "getElementById"> = document,
): boolean {
  if (!isReady || !hash.startsWith("#")) return false
  const id = hash.slice(1)
  if (!portfolioHashTargets.has(id)) return false
  const target = root.getElementById(id)
  if (!target) return false
  target.scrollIntoView({ block: "start" })
  return true
}
