import type { ResearchQuery, ResearchResponse, SourceCitation } from '../types/research';
import { API_BASE } from './apiBase';

export const askResearchAssistant = async (query: ResearchQuery): Promise<ResearchResponse> => {
  const res = await fetch(`${API_BASE}/api/research/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) {
    throw new Error(`Research assistant request failed (${res.status})`);
  }
  return res.json();
};

export interface StreamCallbacks {
  onSources?: (sources: SourceCitation[], basedOn: string) => void;
  onToken?: (text: string) => void;
  onDone?: (points: string[]) => void;
  onFollowUps?: (followUps: string[]) => void;
  onError?: (err: unknown) => void;
}

// Consumes the backend's Server-Sent Events stream (`event: sources|token|done`)
// so the UI can render the answer as it's generated instead of waiting for
// the full LLM response.
export const streamResearchAssistant = async (query: ResearchQuery, cb: StreamCallbacks): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/api/research/query/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Research assistant stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        const lines = frame.split('\n');
        const eventLine = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;

        const event = eventLine.slice('event:'.length).trim();
        const data = JSON.parse(dataLine.slice('data:'.length).trim());

        if (event === 'sources') cb.onSources?.(data.sources, data.basedOn);
        else if (event === 'token') cb.onToken?.(data.text);
        else if (event === 'done') cb.onDone?.(data.points);
        else if (event === 'followups') cb.onFollowUps?.(data.followUps);
      }
    }
  } catch (err) {
    cb.onError?.(err);
  }
};
