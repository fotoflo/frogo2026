# Frogo TV — Sitemap & Onboarding Spec

> For: agent building the public sitemap and first-visit onboarding UX.
> Source of truth: `frogo-taxonomy-v3.md` (external).

---

## Models (who builds what)

| Task | Model | Why |
| --- | --- | --- |
| **Building the sitemap / onboarding UI** (landing page, folder grid, persona quiz, mood entry) | **Sonnet 4.6** default; **Opus 4.7** only for hard UX/design calls | React/TSX, Tailwind v4, App Router work — Sonnet handles this cleanly. |
| **Seeding empty channels from this spec** (creating the 10 top-level folders + featured children) | **Haiku 4.5** | Mechanical CRUD against the FrogoTV MCP. |
| **Populating each seeded channel with videos** | See [`curator-worker-prompt.md`](./curator-worker-prompt.md) | One Haiku worker per leaf; Sonnet only for flagship taste folders. |
| **Editorial / ordering decisions** (which folders get top placement, which videos go in the featured row) | **Orchestrator (Sonnet 4.6 / Opus 4.7)** | Taste call. Not delegated. |

---

## Site

- **Name:** Frogo TV
- **Tagline:** *A taxonomy of an interesting life*
- **Domain:** frogo.tv
- **Premise:** Curated playlists of YouTube videos, organized into hand-built folders. Not an aggregator — a point of view. Each top-level folder is a domain of attention. The user is browsing the curator's taste, not searching.

## Conventions

- **About video:** any folder may contain an `about` video at its root — a short 1–3 minute explainer of what lives in that folder and why. Slug `about`. Render prominently at top of folder page when present.
- **Depth:** organic. Sub-folders exist only when content justifies; do not force symmetry.
- **Slugs:** lowercase-with-hyphens, charset `[a-z0-9-]+`.

---

## Top-level folders

| Path | Name | Icon | Tagline | Status | Depth |
| --- | --- | --- | --- | --- | --- |
| `/kids` | Kids | 🧒 | Kid-safe curated TV | existing | 2 |
| `/music` | Music | 🎵 | Music for listening, working, traveling | new | 3 |
| `/cooking` | Cooking | 🔪 | Food from everywhere, made at home | new | 2 |
| `/travel` | Travel | ✈️ | Places, slowly | new | 2 |
| `/book-club` | Book Club | 📖 | Books, through video | new | 2 |
| `/surf-and-board` | Surf & Board | 🏄 | Board sports from ocean to mountain | new | 3 |
| `/learning` | Learning | 🧠 | Teach yourself anything | new | 4 |
| `/philosophy` | Philosophy | 🏛️ | Big ideas, worked through | existing | 2 |
| `/business` | Business | 💼 | Startup and operator wisdom — an archive | legacy | 2 |
| `/comfort-tv` | Comfort TV | 🛋️ | Slow TV for when you don't want to choose | new | 2 |

### Folder details

- **`/kids`** — Hand-picked children's shows: early learning, classic cartoons, nature, science. Organized by show. *Featured children:* `/kids/bluey`, `/kids/kurzgesagt`, `/kids/peppa`, `/kids/numberblocks`. Vibe: trusted, diverse, ad-free-feel. Moment: kids want to watch something and parents don't want to worry.
- **`/music`** — Jazz, classical, electronic, world music, live sessions (Tiny Desk, Boiler Room). *Featured children:* `/music/jazz`, `/music/world`, `/music/live-sessions`, `/music/focus`. Vibe: deep, genre-spanning, global.
- **`/cooking`** — Cuisines, techniques, chef documentaries. Strong Asian emphasis (Thai, Chinese, South Asian, Japanese). Vibe: hands-on, global, technique-forward.
- **`/travel`** — By region and mood. Long-form over vlogs. Bourdain-style depth, slow travel, trains. Vibe: place-rich, slow, long-form.
- **`/book-club`** — Author interviews, book lectures, poetry readings, fiction deep-dives. Persian poetry (Hafez) and classical Chinese literature strong. Vibe: literary, patient, ideas-first.
- **`/surf-and-board`** — Surfing, skateboarding, snowboarding, longboarding. Heavy SE Asia wave focus (Indonesia, Thailand). Vibe: physical, outdoor, traveler-adjacent.
- **`/learning`** — University courses (CS, physics, econ, math), programming, languages (Thai, Mandarin, Persian), design, investing, personal finance. *Featured children:* `/learning/university`, `/learning/programming`, `/learning/languages`. Vibe: rigorous, structured, long-term.
- **`/philosophy`** — Ancient and Eastern philosophy, ethics, game theory, philosophy of mind, political philosophy, Buddhism. Vibe: contemplative, substantive, non-dogmatic.
- **`/business`** — Legacy archive: best startup, founder, leadership content. Not the forward edge — see `/learning` for that. Vibe: archival, practical, founder-shaped.
- **`/comfort-tv`** — Competent people doing gentle work. Bob Ross, Rick Steves, Huell Howser, NHK, slow TV, Mr. Bean, Julia Child. **Long-form / full-episode only — no clip compilations.** *Featured children:* `/comfort-tv/bob-ross`, `/comfort-tv/rick-steves`, `/comfort-tv/slow-tv`.

---

## Standalone top-level channels

Not folders — legacy personal taste. Flat, not parent channels.

| Path | Name | Icon | Tagline | Rationale |
| --- | --- | --- | --- | --- |
| `/analog-horror` | Analog Horror | 📼 | Hijacked broadcasts and cursed tapes | Distinct internet-native aesthetic, doesn't fit taxonomy |
| `/jon-stewart` | Jon Stewart Vs. The World | 📺 | Media critique and political comedy | — |
| `/viral-classics` | Viral Classics | ✨ | The best of September 2012 | Cultural archaeology, standalone curatorial stance |

---

## Onboarding

### Landing page structure

1. **Hero** — site tagline, 1-line premise, optional site-level `/about` video embed.
2. **Folder grid** — all 10 top-level folders as large tiles (icon + tagline). Editorial ordering: put Music, Kids, Comfort TV near top for mass appeal.
3. **Featured row** — 4–6 featured videos pulled from across folders. Refresh weekly.
4. **Standalone channels** — below folder grid, smaller tiles, labeled "More channels".

### Personas (optional "show me what fits" quiz)

| ID | Label | Primary folders |
| --- | --- | --- |
| `cook` | I like to cook | `/cooking`, `/travel`, `/comfort-tv` |
| `learner` | I'm here to learn something | `/learning`, `/book-club`, `/philosophy` |
| `parent` | I have kids | `/kids` |
| `listener` | I'm here for the music | `/music` |
| `traveler` | Take me somewhere | `/travel`, `/comfort-tv`, `/cooking` |
| `comfort` | I just want to chill | `/comfort-tv` |
| `thinker` | Big ideas, please | `/philosophy`, `/book-club`, `/learning/university` |
| `athlete` | Board sports | `/surf-and-board` |

### Mood entry points (alternate discovery surface)

| Mood | Folders |
| --- | --- |
| energetic | `/music`, `/surf-and-board` |
| focused | `/learning`, `/music/focus` |
| curious | `/book-club`, `/philosophy`, `/travel` |
| nostalgic | `/viral-classics`, `/comfort-tv` |
| unwinding | `/comfort-tv`, `/cooking/chefs-table` |
| with-kids | `/kids` |

---

## Navigation model

- **Primary nav:** folder grid or drawer — all top-level folders + standalone channels.
- **Breadcrumbs:** required. Format: `Frogo › Learning › University › CS › Harvard CS50`.
- **Folder page sections** (in order):
  1. `/about` video if present
  2. Sub-folders grid (if any)
  3. Videos list (if any)
- **Search scope:** all videos across all folders. Highlight folder path in results so users learn the taxonomy by browsing.
