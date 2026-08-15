import { useEffect, useRef, useState } from 'react';
import type { SourceCitation as SC } from '../types/research';
import { streamResearchAssistant } from '../services/researchApi';
import SourceCitation from './SourceCitation';
import { Send, Sparkles, User } from 'lucide-react';

const STARTER_SUGGESTIONS = [
  'What adverse events were most common during the first 30 days?',
  'Show me blood glucose trends over the last 4 weeks',
  'What is the HbA1c distribution at baseline?',
];

type TurnStatus = 'waiting' | 'streaming' | 'done' | 'error';

interface ChatTurn {
  id: number;
  question: string;
  answer: string;
  points: string[];
  basedOn: string;
  sources: SC[];
  followUps: string[];
  status: TurnStatus;
}

let nextTurnId = 0;

export default function ResearchChat({ studyId }: { studyId: string }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setQuestion('');

    const id = ++nextTurnId;
    setTurns(prev => [
      ...prev,
      { id, question: q, answer: '', points: [], basedOn: '', sources: [], followUps: [], status: 'waiting' },
    ]);
    const update = (patch: Partial<ChatTurn>) =>
      setTurns(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

    await streamResearchAssistant({ question: q, studyId }, {
      onSources: (sources, basedOn) => update({ sources, basedOn, status: 'streaming' }),
      onToken: text => setTurns(prev => prev.map(t => (t.id === id ? { ...t, answer: t.answer + text } : t))),
      onDone: points => update({ points, status: 'done' }),
      onFollowUps: followUps => update({ followUps }),
      onError: () => update({ status: 'error', answer: 'Something went wrong reaching the research assistant.' }),
    });

    setBusy(false);
  };

  const lastTurn = turns[turns.length - 1];

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 580 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Research Assistant</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
          Ask questions about this study. Answers stream live and are grounded in participant reports and records.
        </p>
      </div>

      {/* Messages (scrollable) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {turns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 12px' }}>
            <Sparkles size={22} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Try asking:</div>
            <div className="flex gap-2 flex-wrap" style={{ justifyContent: 'center' }}>
              {STARTER_SUGGESTIONS.map(s => (
                <button key={s} className="btn btn-secondary btn-sm" style={{ fontSize: 11.5 }} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={t.id} style={{ marginBottom: 20 }}>
            {/* Question bubble */}
            <div className="flex items-start gap-2" style={{ marginBottom: 10, justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '85%', background: 'var(--accent-light)', color: 'var(--accent)',
                  borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, fontWeight: 500,
                }}
              >
                {t.question}
              </div>
              <div
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}
              >
                <User size={12} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Answer */}
            {t.status === 'waiting' ? (
              <div className="loading-state" style={{ padding: '4px 0' }}>
                <div className="spinner" />
                Retrieving evidence...
              </div>
            ) : (
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: t.points.length ? 10 : 0 }}>
                  {t.answer}
                  {t.status === 'streaming' && <span className="stream-cursor" aria-hidden>▍</span>}
                </p>
                {t.points.length > 0 && (
                  <ol style={{ paddingLeft: 18, marginBottom: 10 }}>
                    {t.points.map((p, j) => (
                      <li key={j} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, fontWeight: 500 }}>
                        {p}
                      </li>
                    ))}
                  </ol>
                )}
                {/* Sources render only once the analysis has finished streaming */}
                {t.status !== 'streaming' && t.basedOn && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: t.sources.length ? 10 : 0 }}>
                    {t.basedOn}
                  </p>
                )}
                {t.status !== 'streaming' && t.sources.length > 0 && (
                  <>
                    <hr className="divider" style={{ margin: '8px 0' }} />
                    <div className="flex flex-col gap-2">
                      {t.sources.map(s => <SourceCitation key={s.id} source={s} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Follow-up suggestions — only under the most recent completed turn */}
            {i === turns.length - 1 && t.status === 'done' && t.followUps.length > 0 && (
              <div className="flex gap-2 flex-wrap" style={{ marginTop: 10 }}>
                {t.followUps.map(f => (
                  <button
                    key={f}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5 }}
                    onClick={() => ask(f)}
                    disabled={busy}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {lastTurn?.status === 'done' && busy && lastTurn.followUps.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thinking of follow-ups…</div>
        )}
      </div>

      {/* Input bar — pinned to the bottom */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Ask about this study..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(question)}
            disabled={busy}
          />
          <button className="btn btn-primary" onClick={() => ask(question)} disabled={busy || !question.trim()}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
