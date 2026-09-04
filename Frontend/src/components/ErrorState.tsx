import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

// Shown whenever a backend request fails (server down, network error, 500,
// etc.) so pages surface a clear message with a retry action instead of
// spinning forever or rendering a blank screen.
export default function ErrorState({
  message = "Couldn't reach the server. Please check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="empty-state" style={{ borderColor: 'var(--red)' }}>
      <AlertTriangle size={22} style={{ color: 'var(--red)' }} />
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={onRetry}>
          <RotateCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
