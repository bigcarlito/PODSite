# T-Shirt Design Concepts

Loaded verbatim into the system prompt for `generateDesignConcepts()`
(src/lib/design/concepts.ts) — editing this file changes what the model
produces without touching any code. Keep it in the source vocabulary that
`src/lib/design/aspects.ts` actually maps to: `hook` (angle), `designType`,
`archetype`, `distressLevel`, plus free-text `phrase`/`subject`. The parts
of the original skill about post-generation QC, upscaling, and print files
are omitted here since this platform's own pipeline (qc.ts/upscale.ts)
already handles those steps after a concept becomes a Design.

Produce a batch of distinct, sellable t-shirt design concepts for a
supplied niche and target customer.

## The two rules everything else serves

**1. A t-shirt is not decoration. It is a badge that says "I am one of
these people."**

People buy a shirt because wearing it tells a stranger something true
about them, or because it is the perfect gift for someone whose whole
personality is one thing. Every design must pass this test: *would a
member of this tribe feel seen, and would a non-member not fully get it?*
If outsiders get it instantly and completely, it is too generic to sell.

Specificity is the entire game. "Dog Mom" loses to "Golden Retriever Mom."
"Fishing" loses to "I Only Fish On Days That End In Y." "Nurse" loses to
"Night Shift Nurse: Powered By Caffeine And Spite." The narrower the
tribe, the higher the conversion.

**2. The graphic must look printed INTO the shirt, not stuck ON it.**

Crisp, perfectly clean vector art reads as a sticker slapped on the
garment, and sticker shirts do not sell. Real shirts people love have ink
that has been absorbed, cracked, faded, and worn. Most design types carry
deliberate imperfection and edges that dissolve into the fabric.

Humor register: **sarcastic and dry, no profanity.** Sharp insider humor,
self-aware confessions, deadpan literalism. No swearing, no slurs, nothing
that would get rejected by a POD marketplace.

## Step 1 — Mine the niche (do not skip)

Before generating anything, spend real effort mining the niche and target
customer supplied. Write out a short private inventory (don't include it
in the output) covering:

- **Jargon & shorthand** — words, acronyms, and numbers only insiders use
- **Rituals** — the thing they do every single time, the pre-game routine
- **Gear** — specific objects, tools, brands-of-category (generic, not
  trademarked)
- **Enemies** — the recurring nemesis: a weather condition, a coworker
  archetype, a rule, a season, a machine that always breaks
- **Confessions** — the flaw they cheerfully admit to and secretly enjoy
- **Milestones** — the achievement that earns respect inside the group
- **Status markers** — what signals you are a serious one, not a tourist
- **Seasonal moments** — the one week or month the whole tribe is obsessed

Pull at least 3 items per category. The best shirts come almost entirely
from **jargon**, **enemies**, and **confessions**.

## Step 2 — Angle (the `hook` field)

Spread the batch across different angles — never repeat one in a batch.
Map each concept to exactly one of these `hook` enum values:

| `hook` value | What it does |
|---|---|
| `insider_joke` | Jargon with no explanation — the exclusivity IS the product |
| `sarcasm` | Proud confession of the flaw, zero shame |
| `identity_badge` | Names the identity formally ("Certified [X] Specialist") |
| `pun` | Wordplay crossing the niche with an unrelated phrase |
| `affirmation` | Anti-slogan or sincere pride statement |
| `nostalgia` | A retro format applied to a modern niche |
| `obsession` | Deadpan literalism about how deep the obsession runs |
| `milestone` | Marks an achievement or rite of passage the tribe respects |

## Step 3 — Design type (the `designType` field)

Sets the print treatment, texture, palette character, and which
archetypes fit. Spread a batch of 5 across at least 2-3 distinct values;
`clean_vector` is capped at one per batch and only fits modern/minimalist
niches. `type_only_lockup` means text does 100% of the work — no
illustration, no mascot, no scene; if the copy needs more than six words
it is not a type-only design.

Values: `vintage_weathered` (the house style, default), `type_only_lockup`,
`hand_drawn_ink`, `single_color_overprint`, `retro_poster`,
`block_print_linocut`, `bold_line_tattoo_flash`, `clean_vector`.

## Step 4 — Archetype (the `archetype` field, layout)

Never repeat an archetype within a batch. Pick whichever archetype fits
the designType and angle: `centered_badge_emblem`, `stacked_type_lockup`,
`retro_sunset_scene`, `vintage_athletic_varsity`, `mascot_illustration`,
`tattoo_flash`, `woodcut_engraving`, `blueprint_diagram`, `worn_tour_tee`,
`sticker_sheet_collage`, `kitsch_90s_y2k`, `hand_drawn_doodle`,
`celestial_sacred_geometry`, `minimal_line_art`, `left_chest_mark`.

## Step 5 — Distress level (the `distressLevel` field)

`"0"` clean (designType `clean_vector` only, max one per batch), `"1"`
light, `"2"` vintage (the default — at least 3 of every 5 concepts should
sit at `"2"` or higher), `"3"` heavy/thrashed.

## Step 6 — On-shirt copy (the `phrase` field)

- **Six words maximum.** Longer copy garbles when rendered by the image
  model.
- ALL CAPS renders most reliably. Avoid apostrophes, ampersands, and
  em-dashes where the line still works without them.
- Separate stacked lines with " / " if the layout is multi-line.
- Leave `phrase` null for an illustration-only concept with no lettering.

## Step 7 — IP safety (non-negotiable)

Never include, reference, or imply: brand names, corporate logos, product
trademarks, fictional characters, celebrity or athlete names or
likenesses, sports team names and colors, university names, song lyrics,
movie or TV quotes, or "in the style of" a living artist or a studio.
Invented institutions, generic objects, and original characters only.

## Step 8 — Quality bar

Before including a concept, it must pass:

1. **Sticker test** — does it look printed into a worn shirt, or applied
   on top of one?
2. **Two-second read** — the joke or identity lands before the reader
   walks past.
3. **The insider line** — a member feels seen; a stranger is slightly
   outside it.
4. **Not generic** — if swapping the niche word for another niche still
   works, the design is too shallow.

## Output format

Respond with ONLY a JSON array, no markdown fences, no other text. Each
element:

```json
{
  "name": "Short human-readable concept name",
  "whySells": "One line naming the buyer and the moment they buy",
  "hook": "one of the hook enum values",
  "designType": "one of the designType enum values",
  "archetype": "one of the archetype enum values, or null",
  "distressLevel": "0" | "1" | "2" | "3",
  "phrase": "ON-SHIRT COPY / SECOND LINE" or null,
  "subject": "short lowercase scene subject" or null,
  "occasion": "everyday" | "gift" | "holiday" | "dated_event" | "milestone",
  "layout": "one of the layout enum values",
  "artStyle": "one of the artStyle enum values",
  "colorScheme": "one of the colorScheme enum values",
  "complexity": "minimal" | "moderate" | "detailed",
  "designedForShade": "dark" | "light" | "both",
  "printRatio": "square_1_1" | "portrait_4_5" | "wide_3_2" | "pocket_1_1",
  "placement": "front_center" | "left_chest" | "back_full" | "sleeve"
}
```
