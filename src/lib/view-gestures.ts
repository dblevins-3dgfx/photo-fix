// What a gesture does to the view (SPEC.md section 5, Zoom and pan): a
// drag pans by its distance, a pinch zooms from where it started around
// its midpoint and pans by how far the midpoint moved, a double-tap zooms
// to 2x at the point or back to Fit, and a tap lands on the photo (or in
// the margin). The gesture itself is gestureStep's to recognize
// (gesture.ts); the photo area applies what comes back from here.

import type { GestureAction } from './gesture';
import { FIT, panBy, toPhoto, zoomAt, type Size, type View } from './view';

export interface ViewContext {
  // The photo area, in CSS pixels
  area: Size;
  // The photo as turned, in its own pixels
  photo: Size;
  pixelRatio: number;
}

// The zoom past which a double-tap goes back to Fit rather than in
export const ZOOMED_IN = 1.01;
// How far a double-tap zooms in, from Fit
export const DOUBLE_TAP_ZOOM = 2;

// The view after `action`. `pinchFrom` is the view when the pinch began:
// each step of a pinch is measured from it, not from the step before. An
// action that doesn't move the view leaves it as it is.
export function viewAfter(action: GestureAction, view: View, pinchFrom: View, c: ViewContext): View {
  switch (action.type) {
    case 'drag':
      return panBy(view, action.dx, action.dy, c.area, c.photo, c.pixelRatio);
    case 'pinch': {
      const zoomed = zoomAt(pinchFrom, pinchFrom.zoom * action.scale, action.x, action.y, c.area, c.photo, c.pixelRatio);
      return panBy(zoomed, action.dx, action.dy, c.area, c.photo, c.pixelRatio);
    }
    case 'double-tap':
      return view.zoom > ZOOMED_IN ? FIT : zoomAt(view, DOUBLE_TAP_ZOOM, action.x, action.y, c.area, c.photo, c.pixelRatio);
    default:
      return view;
  }
}

// Where a tap at (x, y) in the area lands on the photo, as fractions of
// the turned photo's width and height, or null in the margin
export function tapOnPhoto(x: number, y: number, view: View, c: ViewContext): [number, number] | null {
  const [u, v] = toPhoto(view, x, y, c.area, c.photo);
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}
