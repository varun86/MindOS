/**
 * Rewrite MindOS MCP endpoint URLs in client config text.
 *
 * Matches both historical host forms (localhost and 127.0.0.1) and writes
 * back 127.0.0.1: the MCP server binds an IPv4 socket, and on Windows some
 * HTTP stacks resolve localhost to ::1 first and fail to connect. Rewriting
 * also migrates old localhost-form configs in place.
 */
const MCP_HOST_FORMS = ['localhost', '127.0.0.1'];

export function rewriteMcpClientConfig(raw: string, oldPort: number, newPort: number): string | null {
  let result = raw;
  let touched = false;
  for (const host of MCP_HOST_FORMS) {
    const pattern = `${host}:${oldPort}/mcp`;
    if (!result.includes(pattern)) continue;
    result = result.split(pattern).join(`127.0.0.1:${newPort}/mcp`);
    touched = true;
  }
  return touched ? result : null;
}
