// ---------------------------------------------------------------------------
// NOTE ON ARCHITECTURE CHANGE
// ---------------------------------------------------------------------------
// This app originally ran Gemma fully on-device via @mediapipe/tasks-genai
// (WebGPU, local .task model file). That is no longer what this file does.
//
// Due to WebGPU/device-compatibility issues encountered close to a hackathon
// deadline, this was switched to call Gemma 3 via OpenRouter's hosted API
// instead. This means:
//   - Journal entry text now leaves the device and is sent to OpenRouter's
//     servers for processing. The "entries never leave this device" claim
//     in the UI/README no longer holds and should be updated/removed.
//   - Requires OPENROUTER_API_KEY (as VITE_OPENROUTER_API_KEY) at build
//     time. Because this is a client-only app with no backend, the key
//     ships inside the browser bundle and is visible to anyone who opens
//     devtools. Free-tier OpenRouter keys have low rate limits, bounding
//     the worst case, but this is not a secure way to hold a real secret —
//     don't reuse this key anywhere sensitive.
//   - Still satisfies a "must use Gemma" hackathon rule: OpenRouter is
//     serving a real Gemma model (currently Gemma 4, google/gemma-4-26b-a4b-it),
//     just hosted rather than run locally. NOTE: OpenRouter's free-tier
//     model lineup rotates — Gemma 3's free tier was discontinued mid-July
//     2026. If this model ever 404s again with an "unavailable for free"
//     message, check https://openrouter.ai/models?fmt=cards&max_price=0
//     for the current free Gemma variant and update MODEL_ID below.
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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// google/gemma-3-4b-it:free was discontinued (OpenRouter returned 404,
// "unavailable for free" as of July 2026). Switched to Gemma 4, which has
// confirmed-live free variants as of this week. Using the smaller MoE
// variant (26B, ~4B active params) — a better fit for a quick
// classification task than the larger 31B dense model.
const MODEL_ID = 'google/gemma-4-26b-a4b-it:free';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

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
      'Missing VITE_OPENROUTER_API_KEY. Set this in your deploy environment variables.'
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 256,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error('Unexpected OpenRouter response shape');
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
