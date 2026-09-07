import "server-only";

/**
 * Resolves the current request's own absolute origin (e.g.
 * "https://store.example.com") from its headers — used to turn
 * uploadStoreAsset's host-relative URL ("/api/assets/<id>") into an
 * absolute one before handing it to code that fetches it server-side
 * (an external AI provider, or this server refetching its own upload
 * later) rather than rendering it in a browser, where a relative path
 * would otherwise work fine.
 */
export function originFromHeaders(headers: { get(name: string): string | null }): string {
  const host = headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
