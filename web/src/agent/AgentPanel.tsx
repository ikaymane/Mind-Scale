/**
 * "Ask NIRAN": the agent, docked bottom-right on every page. It talks with people and uses tools on the server
 * (live NASA data, the 2020–2025 archive, watches, alerts). The whole conversation is sent each turn.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../store';
import { api, type ChatAction, type ChatMessage } from '../lib/api';

interface Turn extends ChatMessage { actions?: ChatAction[]; steps?: string[]; engine?: string; error?: boolean }

const SUGGEST = [
  'Hi! What can you do?',
  'I see smoke near my village in Morocco. What should I do?',
  'Is Australia burning more than usual this week?',
  'Was 2022 a bad fire year in Morocco? Why?',
];

/** **bold** inside a line */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

/** Paragraphs, and "- " / "1. " lines as lists: enough for a chat reply, no markdown library. */
function Rich({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        const bullet = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (bullet) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>);
          return ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</Fragment>)}</p>;
      })}
    </>
  );
}

export function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const regionId = useApp((s) => s.regionId);
  const set = useApp((s) => s.set);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns, busy]);
  useEffect(() => { if (open) input.current?.focus(); }, [open, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: question }];
    setTurns(next);
    setText('');
    setBusy(true);
    try {
      const r = await api.chat(next.filter((t) => !t.error).map(({ role, content }) => ({ role, content })), regionId);
      setTurns([...next, { role: 'assistant', content: r.reply, actions: r.actions, steps: r.steps, engine: r.engine }]);
    } catch {
      setTurns([...next, { role: 'assistant', content: 'I cannot reach the NIRAN server right now. Please try again in a moment.', error: true }]);
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
          <strong>NIRAN</strong>
          <span className="footnote">Wildfire-safety agent · NASA satellite data</span>
        </div>
        <div className="agent-head-tools">
          {turns.length > 0 && <button className="link-btn agent-new" onClick={() => setTurns([])}>New chat</button>}
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </header>

      <div className="agent-log" aria-live="polite">
        {turns.length === 0 && (
          <div className="agent-empty">
            <p>Hi, I'm NIRAN. Talk to me about wildfires in Morocco, Brazil or Australia: what is burning now, past seasons, what to do, or ask me to keep watch and alert the fire service.</p>
            <div className="agent-chips">
              {SUGGEST.map((s) => <button key={s} className="agent-chip" onClick={() => ask(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`agent-msg agent-${t.role}${t.error ? ' is-error' : ''}`}>
            {!!t.steps?.length && (
              <ul className="agent-steps" aria-label="What NIRAN did">
                {t.steps.map((s, j) => <li key={j}>{s}</li>)}
              </ul>
            )}
            {t.role === 'assistant' ? <Rich text={t.content} /> : <p>{t.content}</p>}
            {t.actions?.filter((a) => a.type === 'watch').map((a) => (
              <div key={a.region_id} className="agent-action">
                <span className="live-dot" aria-hidden="true" />
                <span>
                  <strong>Live watch on {a.name}.</strong> Confirmed fires go to the fire service.{' '}
                  <button className="link-btn" onClick={() => set({ page: 'dispatch' })}>Open the fire-service console</button>
                </span>
              </div>
            ))}
            {t.engine?.startsWith('template') && <span className="agent-engine mono">rule-based answer (AI offline)</span>}
          </div>
        ))}
        {busy && <div className="agent-msg agent-assistant agent-typing" aria-label="NIRAN is thinking"><span /><span /><span /></div>}
        <div ref={end} />
      </div>

      <form className="agent-form" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <textarea
          ref={input} rows={1} value={text} placeholder="Write to NIRAN…" aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }}
        />
        <button type="submit" className="agent-send" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
