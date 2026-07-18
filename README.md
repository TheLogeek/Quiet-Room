# MindMirror — scaffold

A private, on-device mental health check-in journal. Gemma classifies each
entry (mood + topics) fully client-side via MediaPipe's LLM Inference API —
no server, no network call, ever.

## What's already built

- `src/lib/gemma.js` — the extraction prompt (structured JSON output, fixed
  topic taxonomy, few-shot example), plus a request queue so MediaPipe's
  single-generation-at-a-time limitation doesn't crash the app.
- `src/lib/storage.js` — IndexedDB schema for entries, all local.
- `src/lib/patterns.js` — rule-based trend/pattern detection. **Deliberately
  not another Gemma call** — the "you might want to talk to someone" message
  is fixed, reviewed copy, not model-generated, so it can't drift into
  something alarming or wrong under demo conditions.
- `src/App.jsx` — check-in form, mood trend, pattern list, history.

## Setup

```bash
npm install
```

You need a converted Gemma `.task` model file. Two options:

1. **Fastest for a hackathon:** use Google's hosted quickstart model from the
   MediaPipe samples repo (https://github.com/google-ai-edge/mediapipe-samples)
   and point `MODEL_URL` in `src/lib/gemma.js` at it directly.
2. **Best for the "no wifi" demo pitch:** download a Gemma 3n E2B `.task`
   file yourself, put it in `public/models/gemma-3n-e2b.task`, and the
   service worker (configured in `vite.config.js`) will cache it after first
   load — genuinely offline after that.

Then:

```bash
npm run dev
```

## Before you demo — do these, in order

1. **Test on the actual demo device**, not just your dev laptop. WebGPU
   support varies a lot across browsers/devices; have a fallback plan if the
   judges' machine doesn't support it.
2. **Pre-load the model before your slot.** `preloadModel()` is called on
   app mount, but the first download + WebGPU compile can take 30–90
   seconds. Open the app and let it finish loading well before you're on.
3. **Seed a few fake entries** ahead of time so the trend/pattern sections
   have something to show — a single live entry won't demonstrate the
   "patterns over time" pitch.
4. **Test the JSON extraction on real device hardware**, not just in your
   head. Small quantized models occasionally ignore formatting instructions;
   the retry-once-then-fail-soft logic in `gemma.js` is there so a bad
   generation degrades gracefully instead of crashing the check-in.

## What's intentionally left out of this scaffold

- Any settings/onboarding UI — add if you have time, skip if you don't.
- Data export/delete-all UI (the storage function exists — `deleteAllEntries()`
  in `storage.js` — just no button wired up yet).
- App icons/full PWA manifest polish.

These are the parts that are safe to build fast, badly, or last. The
extraction prompt and the fixed-copy support nudge are the parts worth
protecting time for.
