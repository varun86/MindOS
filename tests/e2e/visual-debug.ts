import type { Page, PageScreenshotOptions } from '@playwright/test';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isVisualDebugEnabled(value = process.env.MINDOS_VISUAL_DEBUG): boolean {
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase());
}

export async function saveVisualDebugScreenshot(
  page: Page,
  path: string,
  options: Omit<PageScreenshotOptions, 'path'> = {},
): Promise<void> {
  if (!isVisualDebugEnabled()) return;
  await page.screenshot({ path, ...options });
}
