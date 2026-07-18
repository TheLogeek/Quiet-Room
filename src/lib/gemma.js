// ---------------------------------------------------------------------------
// NOTE ON ARCHITECTURE CHANGE
// ---------------------------------------------------------------------------
// This app originally ran Gemma fully on-device via @mediapipe/tasks-genai
// (WebGPU, local .task model file). That is no longer what this file does.
//
// Due to WebGPU/device-compatibility issues encountered close to a hackathon
// deadline, this was switched to a hosted API call instead. First tried
// OpenRouter's free tier, but hit two dead ends there: the free Gemma 3
// slug was discontinued mid-July 2026, and its replacement (free Gemma 4)
// draws from a shared rate-limit pool across ALL OpenRouter users hitting
// that model — got 429'd after a single successful call, unrelated to our
// own usage.
//
// Now calling Google AI Studio's Gemini API directly instead, which serves
// Gemma models on the same generateContent endpoint with a free tier tied
// to YOUR OWN account/project, not a shared pool. See:
// https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
//
// This means:
//   - Journal entry text now leaves the device and is sent to Google's
//     servers for processing. The "entries never leave this device" claim
//     in the UI/README no longer holds and should be updated/removed.
//   - Requires a Google AI Studio API key (as VITE_GOOGLE_API_KEY) at
//     build time. Because this is a client-only app with no backend, the
//     key ships inside the browser bundle and is visible to anyone who
//     opens devtools. Don't reuse this key anywhere sensitive — Google's
//     docs explicitly recommend a backend proxy for production, which
//     this app does not have. Free-tier rate limits bound the worst case.
//   - Still satisfies a "must use Gemma" hackathon rule: this calls Gemma
//     4 (gemma-4-26b-a4b-it), a real Gemma model, hosted by Google itself
//     rather than run locally.
// ---------------------------------------------------------------------------

export const TOPICS = [
  'sleep',
  'stress',
  'work',
  'school',
  'social',
  'family',
  'health',
  'money',
];

const MOOD_SCALE = '1 (very low) to 5 (very good)';

const MODEL_ID = 'gemma-4-26b-a4b-it';
const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

function buildExtractionPrompt(entryText) {
  return `You are a text classifier for a private journaling app. Read the journal entry and output ONLY a single JSON object, no other text, no markdown fences.

Schema:
{
  "mood": <integer 1-5, where ${MOOD_SCALE}>,
  "topics": [<0 to 3 strings, each must be one of: ${TOPICS.join(', ')}>],
  "reflection": "<one short neutral sentence, max 15 words, describing what the entry contains. Never diagnose, never use clinical terms, never give advice.>"
}

Example entry: "Barely slept again, and I've got two deadlines this week. Kind of dreading tomorrow."
Example output: {"mood": 2, "topics": ["sleep", "work"], "reflection": "Entry describes poor sleep and upcoming work deadlines."}

Journal entry: "${entryText.replace(/"/g, "'")}"

Output JSON:`;
}

// No local model to preload anymore; kept as a no-op so App.jsx doesn't
// need to change its call site.
export function preloadModel() {
  return Promise.resolve();
}

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model output');
  return JSON.parse(match[0]);
}

function sanitize(parsed) {
  const mood = Number.isInteger(parsed.mood)
    ? Math.min(5, Math.max(1, parsed.mood))
    : 3;

  const topics = Array.isArray(parsed.topics)
    ? parsed.topics.filter((t) => TOPICS.includes(t)).slice(0, 3)
    : [];

  const reflection =
    typeof parsed.reflection === 'string'
      ? parsed.reflection.slice(0, 200)
      : '';

  return { mood, topics, reflection };
}

async function callGemma(prompt) {
  if (!API_KEY) {
    throw new Error(
      'Missing VITE_GOOGLE_API_KEY. Set this in your deploy environment variables.'
    );
  }

  const response = await fetch(GOOGLE_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        // Raised from 256: Gemma 4 has an internal "thinking" mode that
        // can consume the token budget on hidden reasoning before ever
        // producing real output, causing "no JSON object found" failures
        // with no HTTP error. thinkingLevel below should stop this, but
        // keep headroom in case thinking isn't fully suppressed.
        maxOutputTokens: 512,
        // includeThoughts: false is silently ignored on Gemma 4 (confirmed
        // bug: google-gemini/cookbook#1198). thinkingLevel: "MINIMAL" is
        // the setting that actually produces zero thought tokens.
        thinkingConfig: {
          thinkingLevel: 'MINIMAL',
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google AI Studio request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  // Defensive: even with thinkingLevel MINIMAL, Google's docs note larger
  // models may still occasionally emit a thought part. Skip any part
  // marked "thought": true and only use real answer text.
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((p) => !p.thought)
        .map((p) => p.text || '')
        .join('')
    : undefined;
  if (!text) {
    throw new Error('Unexpected Google AI Studio response shape');
  }
  return text;
}

// Public API: takes raw journal text, returns { mood, topics, reflection }.
export async function extractEntry(entryText) {
  const prompt = buildExtractionPrompt(entryText);

  try {
    const raw = await callGemma(prompt);
    return sanitize(extractJson(raw));
  } catch (err) {
    try {
      const retryRaw = await callGemma(
        prompt + '\n\n(Reminder: output ONLY the JSON object, nothing else.)'
      );
      return sanitize(extractJson(retryRaw));
    } catch (err2) {
      console.error('Gemma extraction failed twice:', err2);
      return { mood: null, topics: [], reflection: '' };
    }
  }
}
