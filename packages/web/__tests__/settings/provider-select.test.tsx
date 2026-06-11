// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ProviderSelect from '@/components/shared/ProviderSelect';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ProviderSelect settings mode', () => {
  it('shows saved provider entries only so unconfigured templates are not implicit add actions', async () => {
    const onChange = vi.fn();
    const onAdd = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ProviderSelect
          value="p_openai01"
          onChange={onChange}
          compact
          providerEntries={[
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          ]}
          onAdd={onAdd}
        />,
      );
    });

    expect(host.textContent).toContain('OpenAI');
    expect(host.textContent).not.toContain('Anthropic');
    expect(host.textContent).not.toContain('More providers');
    expect(host.querySelector('[data-provider-entry-grid]')?.className).toContain('sm:grid-cols-2');
    expect(host.querySelector('[data-provider-entry-grid]')?.className).toContain('xl:grid-cols-3');

    const openAiButton = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('OpenAI'));
    const addButton = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Add provider'));
    expect(openAiButton).toBeDefined();
    expect(addButton).toBeDefined();

    await act(async () => {
      openAiButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onChange).toHaveBeenCalledWith('p_openai01');

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onAdd).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('keeps setup mode protocol selection separate from provider entry mode', async () => {
    const onChange = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ProviderSelect
          value="openai"
          onChange={onChange}
          compact
          showSkip
          configuredProviders={new Set(['openai'])}
        />,
      );
    });

    expect(host.textContent).toContain('OpenAI');
    expect(host.textContent).toContain('Skip for now');

    const anthropicButton = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Anthropic'));
    expect(anthropicButton).toBeDefined();

    await act(async () => {
      anthropicButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onChange).toHaveBeenCalledWith('anthropic');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
