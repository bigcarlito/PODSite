/** Identify a local record without fetching or trusting the URL's host. */
export function localAssetId(value: string | undefined) {
  if (!value || !/^(?:\/api\/assets\/|https?:\/\/)/i.test(value)) return undefined;
  try {
    const url = new URL(value, "https://factory.invalid");
    return /^\/api\/assets\/([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1];
  } catch { return undefined; }
}

export function sameAssetUrl(a: string, b: string) {
  return a === b || (!!localAssetId(a) && localAssetId(a) === localAssetId(b));
}
