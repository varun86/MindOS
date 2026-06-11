'use client';

import { Globe } from 'lucide-react';
import type { AiTabProps } from '../types';
import { Field, PasswordInput, SettingCard } from '../Primitives';

const WEB_SEARCH_PROVIDERS = [
  { id: 'auto', labelKey: 'providerAuto', descKey: 'providerAutoDesc' },
  { id: 'exa', labelKey: 'providerExa', descKey: 'providerExaDesc' },
  { id: 'perplexity', labelKey: 'providerPerplexity', descKey: 'providerPerplexityDesc' },
  { id: 'gemini', labelKey: 'providerGemini', descKey: 'providerGeminiDesc' },
];

const WEB_SEARCH_KEY_FIELDS = [
  { key: 'exaApiKey' as const, labelKey: 'exaApiKey', placeholder: 'exa-...' },
  { key: 'perplexityApiKey' as const, labelKey: 'perplexityApiKey', placeholder: 'pplx-...' },
  { key: 'geminiApiKey' as const, labelKey: 'geminiApiKey', placeholder: 'AIza...' },
];

export function WebSearchCard({ data, setData, t }: {
  data: AiTabProps['data'];
  setData: AiTabProps['setData'];
  t: AiTabProps['t'];
}) {
  const w = t.settings.webSearch ?? {} as Record<string, unknown>;
  const wsData = data.webSearch ?? { provider: 'auto', exaApiKey: '', perplexityApiKey: '', geminiApiKey: '' };
  const activeProvider = wsData.provider || 'auto';

  return (
    <SettingCard
      icon={<Globe size={15} />}
      title={w.title as string ?? 'Web Search'}
      description={w.description as string ?? 'Configure search providers.'}
    >
      <div className="flex gap-2 flex-wrap">
        {WEB_SEARCH_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              setData(current => current ? { ...current, webSearch: { ...wsData, provider: provider.id } } : current);
            }}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              activeProvider === provider.id
                ? 'border-[var(--amber)] text-[var(--amber)] bg-[var(--amber)]/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {(w as Record<string, unknown>)[provider.labelKey] as string ?? provider.id}
          </button>
        ))}
      </div>

      {(() => {
        const provider = WEB_SEARCH_PROVIDERS.find(item => item.id === activeProvider);
        if (!provider) return null;
        const description = (w as Record<string, unknown>)[provider.descKey] as string;
        return description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null;
      })()}

      {WEB_SEARCH_KEY_FIELDS.map(field => (
        <Field key={field.key} label={(w as Record<string, unknown>)[field.labelKey] as string ?? field.key} hint={w.apiKeyHint as string}>
          <PasswordInput
            value={(wsData as Record<string, string>)[field.key] ?? ''}
            onChange={value => setData(current => current ? { ...current, webSearch: { ...wsData, [field.key]: value } } : current)}
            placeholder={field.placeholder}
          />
        </Field>
      ))}

      <p className="text-xs text-muted-foreground">
        {w.noKeysHint as string ?? 'Works without API keys via Exa MCP (zero-config).'}
      </p>
    </SettingCard>
  );
}
