// Zoom and pan (SPEC.md section 5, Zoom and pan): which part of the photo
// the photo area shows, and at what size. All positions here are on the
// photo as turned (section 6), except `visibleRegion`, which answers in
// pixels of the original as opened.

import { unrotatePoint } from './rotation';
import type { Rotation } from './settings';

export interface Size {
  width: number;
  height: number;
}

// zoom 1 is Fit; (cx, cy) is the point of the photo at the middle of the
// photo area, as fractions of its width and height
export interface View {
  zoom: number;
  cx: number;
  cy: number;
}

export const FIT: View = { zoom: 1, cx: 0.5, cy: 0.5 };

// The space kept around the photo at Fit, in CSS pixels
export const MARGIN = 8;

// CSS pixels per pixel of the photo at Fit
export const fitScale = (area: Size, photo: Size) =>
  Math.min(Math.max(1, area.width - 2 * MARGIN) / photo.width, Math.max(1, area.height - 2 * MARGIN) / photo.height);

export const scaleOf = (v: View, area: Size, photo: Size) => fitScale(area, photo) * v.zoom;

// The zoom at which one pixel of the photo covers one pixel of the screen
// (100%), never below Fit
export const zoom100 = (area: Size, photo: Size, pixelRatio: number) =>
  Math.max(1, 1 / (pixelRatio * fitScale(area, photo)));

// As far as zooming goes: 4x Fit, or twice 100%, whichever is more
export const maxZoom = (area: Size, photo: Size, pixelRatio: number) => Math.max(4, 2 * zoom100(area, photo, pixelRatio));

export const PRESETS = ['Fit', '100%', '2x', '4x'] as const;
export type Preset = (typeof PRESETS)[number];

export function presetZoom(p: Preset, area: Size, photo: Size, pixelRatio: number) {
  switch (p) {
    case 'Fit': return 1;
    case '100%': return zoom100(area, photo, pixelRatio);
    case '2x': return 2;
    case '4x': return 4;
  }
}

// The zoom kept within Fit and the most, and the photo kept covering the
// area where it is larger than it (centered where it is smaller)
export function clampView(v: View, area: Size, photo: Size, pixelRatio: number): View {
  const zoom = Math.min(maxZoom(area, photo, pixelRatio), Math.max(1, v.zoom));
  const s = fitScale(area, photo) * zoom;
  const hx = area.width / (2 * s * photo.width);
  const hy = area.height / (2 * s * photo.height);
  const cx = hx >= 0.5 ? 0.5 : Math.min(1 - hx, Math.max(hx, v.cx));
  const cy = hy >= 0.5 ? 0.5 : Math.min(1 - hy, Math.max(hy, v.cy));
  return { zoom, cx, cy };
}

// The point of the photo (fractions) under a point of the area (CSS pixels
// from its top-left corner). Outside 0 to 1 is off the photo.
export function toPhoto(v: View, x: number, y: number, area: Size, photo: Size): [number, number] {
  const s = scaleOf(v, area, photo);
  return [v.cx + (x - area.width / 2) / (s * photo.width), v.cy + (y - area.height / 2) / (s * photo.height)];
}

// Zooms to `zoom`, keeping the point of the photo under (x, y) where it is
export function zoomAt(v: View, zoom: number, x: number, y: number, area: Size, photo: Size, pixelRatio: number): View {
  const [u, w] = toPhoto(v, x, y, area, photo);
  const z = Math.min(maxZoom(area, photo, pixelRatio), Math.max(1, zoom));
  const s = fitScale(area, photo) * z;
  return clampView(
    { zoom: z, cx: u - (x - area.width / 2) / (s * photo.width), cy: w - (y - area.height / 2) / (s * photo.height) },
    area, photo, pixelRatio);
}

// Moves the photo by (dx, dy) CSS pixels, as a drag does
export function panBy(v: View, dx: number, dy: number, area: Size, photo: Size, pixelRatio: number): View {
  const s = scaleOf(v, area, photo);
  return clampView({ ...v, cx: v.cx - dx / (s * photo.width), cy: v.cy - dy / (s * photo.height) }, area, photo, pixelRatio);
}

// The part of the photo in view, as fractions of the turned photo, kept
// within it: for the overview
export function visibleFractions(v: View, area: Size, photo: Size) {
  const [u0, v0] = toPhoto(v, 0, 0, area, photo);
  const [u1, v1] = toPhoto(v, area.width, area.height, area, photo);
  const c = (n: number) => Math.min(1, Math.max(0, n));
  return { u0: c(u0), v0: c(v0), u1: c(u1), v1: c(v1) };
}

// The part of the original (as opened, width x height, before turning by
// `r`) in view, in whole pixels: what is redrawn from the original when
// zoomed in past the preview
export function visibleRegion(v: View, area: Size, original: Size, r: Rotation, turned: Size) {
  const f = visibleFractions(v, area, turned);
  const a = unrotatePoint(f.u0, f.v0, r);
  const b = unrotatePoint(f.u1, f.v1, r);
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) * original.width));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) * original.height));
  const x1 = Math.min(original.width, Math.ceil(Math.max(a[0], b[0]) * original.width));
  const y1 = Math.min(original.height, Math.ceil(Math.max(a[1], b[1]) * original.height));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

// Whether the preview is shown larger than the screen's pixels (more than
// 5% over), so that the part in view is redrawn from the original.
// `previewPerOriginal` is the preview's width over the original's.
export const needsDetail = (v: View, area: Size, turned: Size, pixelRatio: number, previewPerOriginal: number) =>
  scaleOf(v, area, turned) * pixelRatio > previewPerOriginal * 1.05;

// The size to redraw a region at: the screen pixels it covers, never more
// than the original's own
export function detailSize(region: Size, scale: number, pixelRatio: number): Size {
  return {
    width: Math.max(1, Math.min(region.width, Math.round(region.width * scale * pixelRatio))),
    height: Math.max(1, Math.min(region.height, Math.round(region.height * scale * pixelRatio))),
  };
}
