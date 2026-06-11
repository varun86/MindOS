export const PORT_MIN = 1024;
export const PORT_MAX = 65535;

export interface PortStatus {
  checking: boolean;
  available: boolean | null;
  isSelf: boolean;
  suggestion: number | null;
  invalid?: boolean;
}

export interface CheckPortResult {
  available: boolean;
  isSelf?: boolean;
  suggestion?: number | null;
}

export const EMPTY_PORT_STATUS: PortStatus = {
  checking: false,
  available: null,
  isSelf: false,
  suggestion: null,
};

export function parsePortInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isValidUserPort(port: number): boolean {
  return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX;
}

export function isPortUnavailable(status: PortStatus): boolean {
  return status.checking || (status.available === false && !status.isSelf);
}

export function invalidPortStatus(): PortStatus {
  return { ...EMPTY_PORT_STATUS, available: false, invalid: true };
}

export function checkingPortStatus(): PortStatus {
  return { ...EMPTY_PORT_STATUS, checking: true };
}
