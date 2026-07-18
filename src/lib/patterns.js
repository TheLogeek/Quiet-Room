// Why this logic is plain JS and not another Gemma call:
// The "gently suggests talking to someone" feature is the one place in this
// product where wording really matters. Handing that to a small on-device
// model's free generation risks inconsistent, overly alarming, or
// under-cautious phrasing — and there's no server-side moderation layer to
// catch it. So: Gemma's job stops at classification (mood/topics). Every
// user-facing pattern message below is a fixed template, hand-reviewed,
// and only the *numbers* are filled in dynamically.

const TOPIC_LABELS = {
  sleep: 'sleep',
  stress: 'stress',
  work: 'work',
  school: 'school',
  social: 'social life',
  family: 'family',
  health: 'health',
  money: 'money',
};

// Tune these thresholds during testing — they're intentionally simple
// (frequency counts over the recent window) rather than anything the model
// infers, so behavior is predictable and easy to explain to judges.
const TOPIC_STREAK_THRESHOLD = 4; // e.g. "sleep" mentioned 4+ times
const LOW_MOOD_THRESHOLD = 2; // mood <= 2 counts as "low"
const LOW_MOOD_STREAK_THRESHOLD = 3;

export function computeMoodTrend(entries) {
  // entries: newest first, from storage.js
  const withMood = entries.filter((e) => typeof e.mood === 'number');
  if (withMood.length === 0) return null;

  const recent = withMood.slice(0, 7);
  const prior = withMood.slice(7, 14);
  const avg = (arr) => arr.reduce((s, e) => s + e.mood, 0) / arr.length;

  return {
    recentAvg: Number(avg(recent).toFixed(1)),
    priorAvg: prior.length ? Number(avg(prior).toFixed(1)) : null,
    entries: recent,
  };
}

export function computeTopicFrequency(entries, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const counts = {};
  for (const e of entries) {
    if (e.createdAt < cutoff) continue;
    for (const t of e.topics || []) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return counts;
}

// Returns an array of { type, message } — plain, fixed-template strings.
// This is what the UI renders as "patterns noticed."
export function detectPatterns(entries) {
  const patterns = [];
  const topicCounts = computeTopicFrequency(entries, 7);

  for (const [topic, count] of Object.entries(topicCounts)) {
    if (count >= TOPIC_STREAK_THRESHOLD) {
      patterns.push({
        type: 'topic-frequency',
        message: `You've mentioned ${TOPIC_LABELS[topic] || topic} in ${count} of your last ${entries.length} entries.`,
      });
    }
  }

  const withMood = entries.filter((e) => typeof e.mood === 'number').slice(0, 7);
  const lowStreak = withMood.filter((e) => e.mood <= LOW_MOOD_THRESHOLD).length;
  if (lowStreak >= LOW_MOOD_STREAK_THRESHOLD) {
    patterns.push({
      type: 'low-mood-streak',
      message: `Your mood has been on the lower end in ${lowStreak} of your last ${withMood.length} entries.`,
      // This is the one message tier that also shows a support suggestion —
      // handled in the UI layer with fixed copy, not model-generated.
      suggestSupport: true,
    });
  }

  return patterns;
}

// Fixed, reviewed copy — never model output. Kept short and non-alarming
// per the "mirror, not diagnosis" principle from the product brief.
//
// Crisis resources are Nigeria-specific (this app targets a Lagos/GDG
// audience). If you fork this for another country, swap these — do not
// leave a US or generic number in here, it won't work for the user.
export const SUPPORT_NUDGE_TEXT =
  "You've mentioned feeling low a few times recently. It might help to talk to someone you trust, or a counselor. This isn't a diagnosis — just a pattern you might want to know about.";

export const CRISIS_RESOURCE_TEXT =
  "If you're in immediate danger, call 112 (Nigeria's national emergency number). " +
  "For free, confidential crisis support, SURPIN (Suicide Research and Prevention Initiative) runs a 24/7 national helpline — visit surpinng.com for current numbers.";
