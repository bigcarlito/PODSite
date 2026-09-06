import { getCurrentStore } from "@/lib/store-context";

/**
 * Optional announcement banner above the header — content is trusted HTML
 * set by the store's own admin/agent (Store.bannerHtml), never end-user
 * input, so rendering it unescaped is intentional. Renders nothing when
 * unset/empty.
 */
export async function Banner() {
  const store = await getCurrentStore();
  const html = store?.bannerHtml?.trim();
  if (!html) return null;

  return (
    <div
      className="bg-accent-dark px-4 py-2 text-center text-sm text-white [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
