/** "Ask NIRAN": the agent, docked bottom-right on every page. Answers come from /api/chat (NASA facts only). */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { api, type ChatAction, type ChatMessage } from '../lib/api';

interface Turn extends ChatMessage { actions?: ChatAction[]; engine?: string; error?: boolean }

const SUGGEST = [
  'Is Morocco burning right now?',
  'Was 2022 unusual in Morocco?',
  'Is Australia above usual this week?',
  'What should people in Australia do?',
];

export function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const regionId = useApp((s) => s.regionId);
  const set = useApp((s) => s.set);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns, busy]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setText('');
    setBusy(true);
    try {
      const r = await api.chat(next.filter((t) => !t.error).map(({ role, content }) => ({ role, content })), regionId);
      setTurns([...next, { role: 'assistant', content: r.reply, actions: r.actions, engine: r.engine }]);
    } catch {
      setTurns([...next, { role: 'assistant', content: 'The NIRAN server is not reachable.', error: true }]);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="agent-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8M8 13h5" /></svg>
        Ask NIRAN
      </button>
    );
  }

  return (
    <section className="agent-panel" role="dialog" aria-label="NIRAN agent">
      <header className="agent-head">
        <div>
          <strong>NIRAN agent</strong>
          <span className="footnote">Answers from NASA FIRMS and NASA POWER data only</span>
        </div>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div className="agent-log" aria-live="polite">
        {turns.length === 0 && (
          <div className="agent-empty">
            <p>Ask about fires in Morocco, Brazil or Australia: right now, past years, or what to do.</p>
            <div className="agent-chips">
              {SUGGEST.map((s) => <button key={s} className="agent-chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`agent-msg agent-${t.role}${t.error ? ' is-error' : ''}`}>
            <p>{t.content}</p>
            {t.actions?.map((a) => (
              <div key={a.region_id} className="agent-action">
                <span className="live-dot" aria-hidden="true" />
                <span>
                  <strong>Live watch started on {a.name}.</strong> {a.reason}. New NASA detections there are checked every few minutes; confirmed fires go to the fire service.{' '}
                  <button className="link-btn" onClick={() => set({ page: 'dispatch' })}>Open fire-service console</button>
                </span>
              </div>
            ))}
            {t.engine && <span className="agent-engine mono">{t.engine.startsWith('template') ? 'rule-based answer' : t.engine}</span>}
          </div>
        ))}
        {busy && <div className="agent-msg agent-assistant agent-typing" aria-label="Thinking"><span /><span /><span /></div>}
        <div ref={end} />
      </div>

      <form className="agent-form" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <textarea
          ref={input} rows={1} value={text} placeholder="Ask about a country…" aria-label="Question"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }}
        />
        <button type="submit" className="agent-send" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
