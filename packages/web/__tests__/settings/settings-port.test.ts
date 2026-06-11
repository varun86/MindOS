import { describe, expect, it } from 'vitest';
import {
  EMPTY_PORT_STATUS,
  checkingPortStatus,
  invalidPortStatus,
  isPortUnavailable,
  isValidUserPort,
  parsePortInput,
} from '@/components/settings/settings-port';

describe('settings port helpers', () => {
  it('validates user-selectable port range', () => {
    expect(isValidUserPort(1024)).toBe(true);
    expect(isValidUserPort(65535)).toBe(true);
    expect(isValidUserPort(1023)).toBe(false);
    expect(isValidUserPort(65536)).toBe(false);
    expect(isValidUserPort(1234.5)).toBe(false);
  });

  it('parses typed port input and preserves the current value for empty input', () => {
    expect(parsePortInput('4567', 3456)).toBe(4567);
    expect(parsePortInput(' 8567 ', 3456)).toBe(8567);
    expect(parsePortInput('', 3456)).toBe(3456);
    expect(parsePortInput('abc', 3456)).toBe(3456);
  });

  it('marks occupied non-self ports as unavailable', () => {
    expect(isPortUnavailable({ ...EMPTY_PORT_STATUS, checking: true })).toBe(true);
    expect(isPortUnavailable({ ...EMPTY_PORT_STATUS, available: false, isSelf: false })).toBe(true);
    expect(isPortUnavailable({ ...EMPTY_PORT_STATUS, available: false, isSelf: true })).toBe(false);
  });

  it('creates isolated status objects', () => {
    const invalid = invalidPortStatus();
    const checking = checkingPortStatus();

    expect(invalid).toEqual({ ...EMPTY_PORT_STATUS, available: false, invalid: true });
    expect(checking).toEqual({ ...EMPTY_PORT_STATUS, checking: true });
    expect(invalid).not.toBe(EMPTY_PORT_STATUS);
    expect(checking).not.toBe(EMPTY_PORT_STATUS);
  });
});
