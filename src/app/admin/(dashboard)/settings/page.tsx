import type { Metadata } from "next";
import { requireCurrentStore } from "@/lib/store-context";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Settings" };

export default async function AdminSettingsPage() {
  const store = await requireCurrentStore();

  const brief = (store.brief as Record<string, unknown>) ?? {};
  const theme = (store.theme as { accent?: string; accentDark?: string }) ?? {};

  return (
    <div>
      <h1 className="text-xl font-semibold">Store Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Brand, theme, and business context — the same fields an agent can set
        via <code>PATCH /api/agent/store</code>.
      </p>

      <SettingsForm
        initial={{
          name: store.name,
          tagline: store.tagline,
          description: store.description,
          tone: store.tone ?? "",
          audience: store.audience ?? "",
          briefMission: typeof brief.mission === "string" ? brief.mission : "",
          briefPricingPhilosophy:
            typeof brief.pricingPhilosophy === "string" ? brief.pricingPhilosophy : "",
          briefVoiceExamples: Array.isArray(brief.voiceExamples)
            ? (brief.voiceExamples as string[]).join("\n")
            : "",
          briefAvoid: Array.isArray(brief.avoid) ? (brief.avoid as string[]).join("\n") : "",
          themeAccent: theme.accent ?? "#3f4a2f",
          themeAccentDark: theme.accentDark ?? "#2c3420",
          trustBadges: Array.isArray(store.trustBadges)
            ? (store.trustBadges as string[]).join("\n")
            : "",
          nav: JSON.stringify(store.nav ?? [], null, 2),
          footerLinks: JSON.stringify(store.footerLinks ?? {}, null, 2),
          socialLinks: JSON.stringify(store.socialLinks ?? [], null, 2),
        }}
      />
    </div>
  );
}
