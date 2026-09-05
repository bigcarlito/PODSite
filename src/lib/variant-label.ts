/** Human-readable label for a variant's option values, e.g. "Forest / S" or "Canvas / 16x20". */
export function formatVariantOptions(options: Record<string, string>): string {
  return Object.values(options).filter(Boolean).join(" / ");
}
