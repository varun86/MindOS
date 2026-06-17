'use client';

import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Field, Input } from '@/components/settings/Primitives';
import type { SetupMessages } from './types';

export interface StepSecurityProps {
  authToken: string;
  onCopy: () => void;
  onGenerate: (seed?: string) => void;
  webPassword: string;
  onPasswordChange: (v: string) => void;
  s: SetupMessages;
}

export default function StepSecurity({
  authToken, onCopy, onGenerate, webPassword, onPasswordChange, s,
}: StepSecurityProps) {
  const [seed, setSeed] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  return (
    <div className="space-y-5">
      <Field label={s.authToken} hint={s.authTokenHint}>
        <div className="flex gap-2">
          <Input value={authToken} readOnly className="font-mono text-xs" />
          <button onClick={onCopy}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Copy size={14} />
            {s.copyToken}
          </button>
          <button onClick={() => onGenerate()}
            aria-label={s.generateToken}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RefreshCw size={14} />
          </button>
        </div>
      </Field>
      <div className="space-y-1.5">
        <button onClick={() => setShowUsage(!showUsage)} className="text-xs text-muted-foreground underline"
          aria-expanded={showUsage}>
          {s.authTokenUsageWhat}
        </button>
        {showUsage && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {s.authTokenUsage}
          </p>
        )}
      </div>
      <div>
        <button onClick={() => setShowSeed(!showSeed)} className="text-xs text-muted-foreground underline"
          aria-expanded={showSeed}>
          {s.authTokenSeed}
        </button>
        {showSeed && (
          <div className="mt-2 flex gap-2">
            <Input value={seed} onChange={e => setSeed(e.target.value)} placeholder={s.authTokenSeedHint} />
            <button onClick={() => { if (seed.trim()) onGenerate(seed); }}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {s.generateToken}
            </button>
          </div>
        )}
      </div>
      <Field label={s.webPassword} hint={s.webPasswordHint}>
        <Input type="password" value={webPassword} onChange={e => onPasswordChange(e.target.value)} placeholder="(optional)" />
      </Field>
    </div>
  );
}
