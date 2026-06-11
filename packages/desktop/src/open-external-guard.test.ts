import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl } from './open-external-guard';

describe('isSafeExternalUrl', () => {
  it('allows http, https and mailto URLs', () => {
    expect(isSafeExternalUrl('http://example.com/page')).toBe(true);
    expect(isSafeExternalUrl('https://example.com/page?q=1')).toBe(true);
    expect(isSafeExternalUrl('mailto:user@example.com')).toBe(true);
  });

  it('allows uppercase scheme variants of allowed protocols', () => {
    expect(isSafeExternalUrl('HTTPS://example.com')).toBe(true);
  });

  it('denies file:// URLs which can execute targets on Windows', () => {
    expect(isSafeExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
    expect(isSafeExternalUrl('FILE:///etc/passwd')).toBe(false);
  });

  it('denies UNC and protocol-relative paths', () => {
    expect(isSafeExternalUrl('\\\\attacker\\share\\payload.exe')).toBe(false);
    expect(isSafeExternalUrl('//attacker/share')).toBe(false);
  });

  it('denies OS scheme-handler URLs', () => {
    expect(isSafeExternalUrl('ms-msdt:/id PCWDiagnostic')).toBe(false);
    expect(isSafeExternalUrl('search-ms:query=x')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('denies malformed and empty input', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('   ')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('http//missing-colon.com')).toBe(false);
  });
});
