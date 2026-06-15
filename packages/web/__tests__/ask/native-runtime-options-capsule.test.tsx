// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import NativeRuntimeOptionsCapsule from '@/components/ask/NativeRuntimeOptionsCapsule';

function renderCapsule(onChange = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <NativeRuntimeOptionsCapsule
        runtimeKind="codex"
        value={{}}
        onChange={onChange}
      />,
    );
  });

  return {
    host,
    onChange,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('NativeRuntimeOptionsCapsule', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('uses titled capsule dropdowns for effort and model override', () => {
    const view = renderCapsule();

    expect(view.host.textContent).toContain('Codex default');
    expect(view.host.textContent).toContain('Medium');

    const effortButton = Array.from(view.host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Medium')) as HTMLButtonElement;
    expect(effortButton).toBeTruthy();

    act(() => {
      effortButton.click();
    });

    expect(document.body.textContent).toContain('Effort');
    expect(document.body.textContent).toContain('High');

    const highOption = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('High')) as HTMLButtonElement;
    act(() => {
      highOption.click();
    });
    expect(view.onChange).toHaveBeenLastCalledWith({ reasoningEffort: 'high' });

    const modelButton = Array.from(view.host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Codex default')) as HTMLButtonElement;
    expect(modelButton).toBeTruthy();

    act(() => {
      modelButton.click();
    });

    expect(document.body.textContent).toContain('Model');
    const input = document.body.querySelector('input[placeholder="gpt-5.4-codex"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, 'gpt-5.4-codex');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const applyButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Apply')) as HTMLButtonElement;
    act(() => {
      applyButton.click();
    });

    expect(view.onChange).toHaveBeenLastCalledWith({ modelOverride: 'gpt-5.4-codex' });

    view.cleanup();
  });
});
