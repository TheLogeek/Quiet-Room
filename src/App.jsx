import { useEffect, useState } from 'react';
import { extractEntry, preloadModel, TOPICS } from './lib/gemma';
import { saveEntry, getAllEntries, deleteAllEntries } from './lib/storage';
import { computeMoodTrend, detectPatterns, SUPPORT_NUDGE_TEXT, CRISIS_RESOURCE_TEXT } from './lib/patterns';
import './App.css';

export default function App() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading-model | extracting | saved
  const [modelReady, setModelReady] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    // Pre-warm the model on app load so the first check-in doesn't eat
    // the download/compile latency. See gemma.js preloadModel().
    setStatus('loading-model');
    preloadModel()
      .then(() => {
        setModelReady(true);
        setStatus('idle');
      })
      .catch((err) => {
        console.error('Model preload failed', err);
        setStatus('idle'); // fail soft — user can still write, extraction retries on submit
      });

    getAllEntries().then(setEntries);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setStatus('extracting');
    const { mood, topics, reflection } = await extractEntry(text);
    const saved = await saveEntry({ text, mood, topics, reflection });

    setEntries((prev) => [saved, ...prev]);
    setText('');
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1500);
  }

  async function handleDeleteAll() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deleteAllEntries();
    setEntries([]);
    setConfirmingDelete(false);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmirror-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const trend = computeMoodTrend(entries);
  const patterns = detectPatterns(entries);
  const showSupportNudge = patterns.some((p) => p.suggestSupport);

  return (
    <div className="app">
      <header>
        <h1>MindMirror</h1>
        <p className="tagline">A private-feeling space to check in with yourself.</p>
        <p className="disclaimer">
          MindMirror is a mirror, not a diagnosis. It doesn't replace a doctor,
          therapist, or counselor.
        </p>
        <p className="ai-note">
          Each entry is read by Gemma 3, which picks up on mood, topics, and
          themes automatically.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="checkin-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="How are you feeling? What's on your mind?"
          rows={4}
        />
        <button type="submit" disabled={status === 'extracting' || !text.trim()}>
          {status === 'extracting' ? 'Reading...' : 'Save check-in'}
        </button>
      </form>

      {trend && (
        <section className="trend">
          <h2>Mood, last 7 entries</h2>
          <p className="big-number">{trend.recentAvg} / 5</p>
          {trend.priorAvg !== null && (
            <p className="hint">
              {trend.recentAvg > trend.priorAvg ? 'Up' : trend.recentAvg < trend.priorAvg ? 'Down' : 'Flat'}{' '}
              from {trend.priorAvg} the week before.
            </p>
          )}
        </section>
      )}

      {patterns.length > 0 && (
        <section className="patterns">
          <h2>Patterns noticed</h2>
          <ul>
            {patterns.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </section>
      )}

      {showSupportNudge && (
        <section className="support-nudge">
          <p>{SUPPORT_NUDGE_TEXT}</p>
          <p className="crisis-resources">{CRISIS_RESOURCE_TEXT}</p>
        </section>
      )}

      <section className="history">
        <h2>Past entries</h2>
        {entries.length === 0 && <p className="hint">Nothing yet — your first check-in will show up here.</p>}
        <ul>
          {entries.map((e) => (
            <li key={e.id}>
              <div className="entry-meta">
                <span>{e.date}</span>
                {typeof e.mood === 'number' && <span>mood {e.mood}/5</span>}
                {e.topics?.length > 0 && <span>{e.topics.join(', ')}</span>}
              </div>
              <p>{e.text}</p>
              {e.reflection && (
                <p className="gemma-reflection">
                  <span className="gemma-tag">Gemma noticed:</span> {e.reflection}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {entries.length > 0 && (
        <section className="data-controls">
          <h2>Your data</h2>
          <button type="button" onClick={handleExport} className="secondary">
            Export as JSON
          </button>
          <button type="button" onClick={handleDeleteAll} className="danger">
            {confirmingDelete ? 'Tap again to confirm delete' : 'Delete all entries'}
          </button>
          {confirmingDelete && (
            <button type="button" onClick={() => setConfirmingDelete(false)} className="secondary">
              Cancel
            </button>
          )}
        </section>
      )}
    </div>
  );
}
