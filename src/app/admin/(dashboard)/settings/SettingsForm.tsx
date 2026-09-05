"use client";

import { useActionState } from "react";
import { updateStoreSettings, type SettingsState } from "../actions";

export type SettingsFormValues = {
  name: string;
  tagline: string;
  description: string;
  tone: string;
  audience: string;
  briefMission: string;
  briefPricingPhilosophy: string;
  briefVoiceExamples: string;
  briefAvoid: string;
  themeAccent: string;
  themeAccentDark: string;
  trustBadges: string;
  nav: string;
  footerLinks: string;
  socialLinks: string;
};

const initialState: SettingsState = {};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {hint && <span className="mb-1 block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const textareaClass = `${inputClass} font-mono text-xs`;

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [state, formAction, pending] = useActionState(
    updateStoreSettings,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Brand</h2>
        <Field label="Store name">
          <input name="name" defaultValue={initial.name} required className={inputClass} />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={initial.tagline} required className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            defaultValue={initial.description}
            required
            rows={3}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tone" hint="Read by agents generating copy — not shown on the storefront.">
            <input name="tone" defaultValue={initial.tone} className={inputClass} />
          </Field>
          <Field label="Audience">
            <input name="audience" defaultValue={initial.audience} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Theme colors</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Accent">
            <input
              type="color"
              name="theme_accent"
              defaultValue={initial.themeAccent}
              className="h-10 w-full rounded-lg border border-border"
            />
          </Field>
          <Field label="Accent (dark)">
            <input
              type="color"
              name="theme_accentDark"
              defaultValue={initial.themeAccentDark}
              className="h-10 w-full rounded-lg border border-border"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Business brief</h2>
        <p className="text-xs text-muted">
          Read by agents before acting — see <code>Store.brief</code> in AGENTS.md.
        </p>
        <Field label="Mission">
          <textarea
            name="brief_mission"
            defaultValue={initial.briefMission}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Pricing philosophy">
          <textarea
            name="brief_pricingPhilosophy"
            defaultValue={initial.briefPricingPhilosophy}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Voice examples" hint="One per line.">
          <textarea
            name="brief_voiceExamples"
            defaultValue={initial.briefVoiceExamples}
            rows={3}
            className={textareaClass}
          />
        </Field>
        <Field label="Things to avoid" hint="One per line.">
          <textarea
            name="brief_avoid"
            defaultValue={initial.briefAvoid}
            rows={3}
            className={textareaClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Trust badges</h2>
        <Field label="Trust badges" hint="One per line, e.g. &quot;25,000+ happy customers&quot;.">
          <textarea
            name="trustBadges"
            defaultValue={initial.trustBadges}
            rows={3}
            className={textareaClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted">
          Nav, footer &amp; social links
        </h2>
        <p className="text-xs text-muted">
          Raw JSON — edit carefully. Each link is{" "}
          <code>{`{"label": "...", "href": "..."}`}</code>.
        </p>
        <Field label="Nav links" hint="Array of links.">
          <textarea
            name="nav"
            defaultValue={initial.nav}
            rows={4}
            spellCheck={false}
            className={textareaClass}
          />
        </Field>
        <Field label="Footer links" hint='Object of group name to array of links, e.g. {"Help": [...]}.'>
          <textarea
            name="footerLinks"
            defaultValue={initial.footerLinks}
            rows={6}
            spellCheck={false}
            className={textareaClass}
          />
        </Field>
        <Field label="Social links" hint="Array of links.">
          <textarea
            name="socialLinks"
            defaultValue={initial.socialLinks}
            rows={4}
            spellCheck={false}
            className={textareaClass}
          />
        </Field>
      </section>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700" role="status">
          Settings saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
