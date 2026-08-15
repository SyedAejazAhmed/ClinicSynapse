import { useState } from 'react';
import type { ResearchResponse } from '../types/research';
import { streamResearchAssistant } from '../services/researchApi';
import SourceCitation from './SourceCitation';
import { Send, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'What adverse events were most common during the first 30 days?',
  'Show me blood glucose trends over the last 4 weeks',
  'What is the HbA1c distribution at baseline?',
];

const EMPTY: ResearchResponse = { answer: '', points: [], basedOn: '', sources: [] };

export default function ResearchChat({ studyId }: { studyId: string }) {
  const [question, setQuestion] = useState('');
  const [waitingForSources, setWaitingForSources] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [response, setResponse] = useState<ResearchResponse | null>(null);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setWaitingForSources(true);
    setStreaming(false);
    setResponse(EMPTY);

    await streamResearchAssistant({ question: q, studyId }, {
      onSources: (sources, basedOn) => {
        setWaitingForSources(false);
        setStreaming(true);
        setResponse(r => ({ ...(r ?? EMPTY), sources, basedOn }));
      },
      onToken: text => {
        setResponse(r => (r ? { ...r, answer: r.answer + text } : r));
      },
      onDone: points => {
        setStreaming(false);
        setResponse(r => (r ? { ...r, points } : r));
      },
      onError: () => {
        setWaitingForSources(false);
        setStreaming(false);
        setResponse(r => ({ ...(r ?? EMPTY), answer: r?.answer || 'Something went wrong reaching the research assistant.' }));
      },
    });
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Research Assistant</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Ask questions about this study. Answers stream live and are grounded in participant reports and records.
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Ask about this study..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(question)}
          />
          <button className="btn btn-primary" onClick={() => ask(question)} disabled={waitingForSources || streaming || !question.trim()}>
            <Send size={13} />
            Ask
          </button>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11.5 }}
              onClick={() => { setQuestion(s); ask(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {waitingForSources && (
        <div className="loading-state">
          <div className="spinner" />
          Retrieving evidence...
        </div>
      )}

      {response && !waitingForSources && (response.answer || response.sources.length > 0) && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Analysis</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {response.answer}
            {streaming && <span className="stream-cursor" aria-hidden>▍</span>}
          </p>
          {response.points.length > 0 && (
            <ol style={{ paddingLeft: 18, marginBottom: 14 }}>
              {response.points.map((p, i) => (
                <li key={i} style={{ fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 6, fontWeight: 500 }}>
                  {p}
                </li>
              ))}
            </ol>
          )}
          {response.basedOn && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{response.basedOn}</p>}
          {response.sources.length > 0 && (
            <>
              <hr className="divider" style={{ margin: '12px 0' }} />
              <div className="section-title" style={{ marginBottom: 8 }}>Sources</div>
              <div className="flex flex-col gap-2">
                {response.sources.map(s => <SourceCitation key={s.id} source={s} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
