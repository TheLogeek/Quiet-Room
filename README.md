# MindMirror

A private-feeling mental health check-in journal. Each entry is read by
Gemma (currently Gemma 4, `gemma-4-26b-a4b-it`), which extracts a mood
score, topic tags, and a short neutral reflection — shown right on the
entry, labeled "Gemma noticed: ...".

## Architecture — read this before you touch the code

This app **used to run Gemma fully on-device** via `@mediapipe/tasks-genai`
(WebGPU, local `.task` model file, genuinely offline after first load). That
is **no longer how this app works.**

Late in a hackathon build, on-device inference hit real, hard-to-debug
device/browser WebGPU compatibility issues under time pressure. The app was
switched to call Gemma through a hosted API instead:

1. First tried OpenRouter's free tier — hit two dead ends: the free Gemma 3
   slug was discontinued, and its free Gemma 4 replacement draws from a
   rate-limit pool **shared across every OpenRouter user hitting that model**
   — got 429'd after a single successful call, unrelated to our own usage.
2. Switched to calling **Google AI Studio's Gemini API directly**
   (`generativelanguage.googleapis.com`), which serves Gemma models on the
   same `generateContent` endpoint Gemini uses, but with a free-tier quota
   tied to **your own** account/project, not a shared pool. This is what's
   currently deployed.

**What this means, honestly:**
- Journal entry text now leaves the device and is sent to Google's servers
  for processing. This app no longer makes an on-device/"never leaves your
  device" privacy claim — the UI copy was updated to reflect that.
- It still satisfies a "must use Gemma" rule: this calls a real Gemma model,
  just hosted by Google rather than run locally in-browser.
- The API key ships inside the browser bundle (see **Security note** below)
  because this is a client-only app with no backend.

If you want to restore true on-device/offline operation later, see
**Reverting to on-device** at the bottom — the old MediaPipe code path is
gone from this version, but the shape of what to rebuild is documented there.

## What's built

- `src/lib/gemma.js` — calls Google AI Studio's `generateContent` endpoint
  directly with a structured-JSON extraction prompt (fixed topic taxonomy,
  few-shot example). Sets `thinkingConfig.thinkingLevel: "MINIMAL"` —
  **required** for Gemma 4, otherwise its internal reasoning mode silently
  eats the whole output token budget before producing any real JSON (this
  is a confirmed upstream bug: `includeThoughts: false` is ignored on
  Gemma 4, only `thinkingLevel: "MINIMAL"` actually works). Response parsing
  also defensively skips any stray `"thought": true` parts. One retry on
  parse failure, then fails soft (`{ mood: null, topics: [], reflection: '' }`)
  rather than crashing the check-in — the raw entry text is always saved
  regardless of whether extraction succeeds.
- `src/lib/storage.js` — IndexedDB schema for entries, all local (this part
  never changed — your journal history still lives only in your own
  browser's IndexedDB, even though the *processing* now goes over the
  network).
- `src/lib/patterns.js` — rule-based trend/pattern detection, plus the fixed
  support-nudge and crisis-resource copy (see below). **Deliberately not
  another Gemma call** — this text is fixed, reviewed copy, not
  model-generated, so it can't drift into something alarming or wrong.
- `src/App.jsx` — check-in form, mood trend, pattern list, history, data
  export/delete-all controls, crisis-resource section.

## Crisis resources

`patterns.js` shows a support nudge plus crisis resources whenever the
pattern detector flags a low-mood streak. Resources are **Nigeria-specific**
(this app was built for the GDG Lagos hackathon):

- **112** — Nigeria's national emergency number
- **SURPIN** (Suicide Research and Prevention Initiative) — 24/7 national
  helpline, see surpinng.com for current numbers

**If you fork this for a different country, update `CRISIS_RESOURCE_TEXT` in
`patterns.js` — do not ship it with the wrong country's emergency numbers.**

## Setup

```bash
npm install
```

You need a Google AI Studio API key:

1. Go to [aistudio.google.com](https://aistudio.google.com), sign in
2. **Get API key** → **Create API key**
3. Copy it (current keys start with `AQ.` — Google migrated away from the
   older `AIza...` format in mid-2026; `AQ.` is expected and correct)

For local dev, copy `.env.example` to `.env.local` and paste your key in as
`VITE_GOOGLE_API_KEY`. For deployment (Vercel/Netlify), set the same
variable name in the project's environment variables settings.

```bash
npm run dev
```

## Security note — read before deploying anywhere real

This app calls Google's API **directly from the browser**, with no backend.
That means `VITE_GOOGLE_API_KEY` ships inside the compiled JS bundle and is
visible to anyone who opens devtools on the deployed site. This is fine for
a hackathon demo but is **not how Google recommends running this in
production** — their docs call for a backend proxy that holds the key
server-side. Free-tier rate limits bound the worst-case damage if someone
extracts and reuses the key, but don't reuse this key anywhere sensitive,
and rotate it after the event if you're concerned.

## Before you demo — do these, in order

1. **Do one real check-in on the actual deployed site**, not just `npm run
   dev` locally, before you're in front of judges. Confirm the mood score,
   topic tags, and "Gemma noticed: ..." line all actually appear.
2. **Seed a few check-ins ahead of time** so the mood trend / pattern
   sections have something to show — a single live entry won't demonstrate
   the "patterns over time" pitch.
3. **Know the privacy story you're telling.** This app no longer processes
   entries on-device. If a judge asks about the "private" framing, the
   honest answer is: it pivoted from on-device to a hosted Gemma API
   partway through the build, for the reasons described above. Entries are
   still only *stored* locally (IndexedDB) — only the momentary
   *processing* call goes over the network.
4. **Have a fallback if Google's API is unreachable at demo time** (network
   issue, quota exhausted, etc.) — the app fails soft and still saves your
   raw entry text, just without mood/topics/reflection. Know what that
   looks like so it doesn't throw you if it happens live.

## Data controls

- **Export as JSON** — downloads all entries as a `.json` file
- **Delete all entries** — requires tapping twice (confirm step) before it
  actually clears IndexedDB

Both are wired up in `App.jsx`, backed by functions in `storage.js`.

## Reverting to on-device (if you want to pick this back up later)

The original design ran Gemma fully client-side via
`@mediapipe/tasks-genai` + WebGPU, using a **Gemma 3 1B** `.task` file
(chosen over larger variants specifically for browser download size). That
dependency and code path have been removed from this version. To rebuild it:

1. `npm install @mediapipe/tasks-genai`
2. Get a Gemma `.task` file compatible with this API — check current
   compatibility carefully, as Google has been migrating some Gemma
   generations to a newer `.litertlm` / LiteRT-LM runtime that this older
   MediaPipe package does not read.
3. Put the model in `public/models/` so it ships same-origin with your
   deploy (avoids CORS entirely — this was a major source of friction the
   first time around; don't fetch the model from an external host like a
   gated Hugging Face URL or a GitHub Release asset, both of which caused
   real problems: HF gating requires a per-request auth token even after
   accepting the license, and GitHub Release assets don't support CORS at
   all).
4. Rewrite `extractEntry`/`callGemma` in `gemma.js` to use
   `LlmInference.createFromOptions` instead of a `fetch` call to Google.
5. Test on your actual target devices — WebGPU support is inconsistent
   across browsers, and this is what motivated the move away from
   on-device in the first place.
