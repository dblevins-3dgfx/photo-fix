// Rotation (SPEC.md section 6): how a photo turned by 0, 90, 180 or 270
// degrees clockwise is drawn, and how a tap on the turned photo maps back to
// the photo as it was opened.

import type { Rotation } from './settings';

// The size of a width x height photo once turned
export const rotatedSize = (width: number, height: number, r: Rotation) =>
  r === 90 || r === 270 ? { width: height, height: width } : { width, height };

// The canvas transform that draws a width x height image turned by r:
// translate by (x, y), then rotate by `angle` radians (clockwise)
export function rotationTransform(width: number, height: number, r: Rotation) {
  switch (r) {
    case 90: return { x: height, y: 0, angle: Math.PI / 2 };
    case 180: return { x: width, y: height, angle: Math.PI };
    case 270: return { x: 0, y: width, angle: -Math.PI / 2 };
    default: return { x: 0, y: 0, angle: 0 };
  }
}

// Where a point on the turned photo lies on the photo as opened. (u, v) and
// the result are fractions of the width and height, 0 to 1.
export function unrotatePoint(u: number, v: number, r: Rotation): [number, number] {
  switch (r) {
    case 90: return [v, 1 - u];
    case 180: return [1 - u, 1 - v];
    case 270: return [1 - v, u];
    default: return [u, v];
  }
}

// The pixel of a width x height image at fractions (x, y), kept inside it
export const pixelAt = (x: number, y: number, width: number, height: number): [number, number] => [
  Math.min(width - 1, Math.max(0, Math.floor(x * width))),
  Math.min(height - 1, Math.max(0, Math.floor(y * height))),
];
