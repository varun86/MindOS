import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type SyncActionMessageValue = {
  type: 'success' | 'error';
  text: string;
};

export function SyncActionMessage({ message }: { message: SyncActionMessageValue | null }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-1.5 text-xs" role="status" aria-live="polite">
      {message.type === 'success' ? (
        <>
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" />
          <span className="text-success">{message.text}</span>
        </>
      ) : (
        <>
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-destructive" />
          <div className="space-y-0.5">
            {message.text.split('\n').map((line, i) => (
              <span key={i} className={`block ${i > 0 ? 'text-destructive/70' : 'text-destructive'}`}>{line}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
