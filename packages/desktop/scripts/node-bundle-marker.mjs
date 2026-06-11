/**
 * Bundled-Node marker — records which platform/arch/version the node/ dir in
 * resources/mindos-runtime actually contains.
 *
 * `existsSync(bin/node)` alone cannot tell a darwin-arm64 node from a
 * linux-x64 one, so a stale dir silently shipped the wrong binary when the
 * target changed between runs (e.g. dist:mac-zip building two arches from one
 * prepare). The marker makes the idempotency check compare the real target.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export const NODE_BUNDLE_MARKER_FILE = '.mindos-node-bundle.json';

export function readNodeBundleMarker(nodeDest) {
  try {
    const parsed = JSON.parse(readFileSync(path.join(nodeDest, NODE_BUNDLE_MARKER_FILE), 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeNodeBundleMarker(nodeDest, { platform, arch, nodeVersion }) {
  writeFileSync(
    path.join(nodeDest, NODE_BUNDLE_MARKER_FILE),
    `${JSON.stringify({ platform, arch, nodeVersion }, null, 2)}\n`,
    'utf-8',
  );
}

/** True only when the bundled node binary exists AND its marker matches the requested target. */
export function isBundledNodeCurrent(nodeDest, expectedBin, { platform, arch, nodeVersion }) {
  if (!existsSync(expectedBin)) return false;
  const marker = readNodeBundleMarker(nodeDest);
  if (!marker) return false; // legacy unmarked dir — re-download to be safe
  return marker.platform === platform && marker.arch === arch && marker.nodeVersion === nodeVersion;
}
