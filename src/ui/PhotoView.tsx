import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShortcut } from '../hooks/useShortcut';
import { applyCorrection, buildTables, type Tables } from '../lib/correction';
import { HOLD_MS, NO_GESTURE, gestureStep, type GestureEvent, type GestureState } from '../lib/gesture';
import { tapOnPhoto, viewAfter } from '../lib/view-gestures';
import { rotatedSize, rotationTransform } from '../lib/rotation';
import {
  FIT, PRESETS, clampView, detailSize, needsDetail, panBy, presetZoom, scaleOf, visibleFractions, visibleRegion,
  zoomAt, type Size, type View,
} from '../lib/view';
import { regionOf, type Region } from '../detail';
import type { Photo } from '../photo';

// The overview's longer side, in CSS pixels
const OVERVIEW = 96;
// How long the view must stay still before the part in view is redrawn from the original
const SETTLE_MS = 200;

// The part of the original in view, as it came from the worker, and the
// same corrected for the screen
interface Detail {
  photoId: number;
  region: Region;
  raw: ImageData;
}

function corrected(image: ImageData, tables: Tables, saturation: number, comparing: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  let out = image;
  if (!comparing) {
    out = new ImageData(image.width, image.height);
    applyCorrection(image.data, out.data, tables, saturation);
  }
  canvas.getContext('2d')!.putImageData(out, 0, 0);
  return canvas;
}

// The photo area (SPEC.md section 5): the corrected photo, turned, at the
// zoom and pan in view (Fit to start). Press and hold compares. With the
// eyedropper armed, a short tap reports where it landed, as fractions of
// the turned photo's width and height. Drag (when zoomed in), pinch,
// Ctrl + scroll, double-tap and the presets zoom and pan.
export default function PhotoView({ photo, comparing, armed, onTap, onHold }: {
  photo: Photo;
  comparing: boolean;
  armed: boolean;
  onTap: (u: number, v: number) => void;
  onHold: (held: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [area, setArea] = useState<Size>({ width: 0, height: 0 });
  const [pixelRatio, setPixelRatio] = useState(() => window.devicePixelRatio || 1);
  const [view, setView] = useState<View>(FIT);
  const [detail, setDetail] = useState<Detail | null>(null);
  const { settings, preview, stats } = photo;
  const rotation = settings.rotation;
  const original = useMemo(() => ({ width: photo.width, height: photo.height }), [photo.width, photo.height]);
  const turned = useMemo(() => rotatedSize(photo.width, photo.height, rotation), [photo.width, photo.height, rotation]);
  const tables = useMemo(() => buildTables(settings, stats), [settings, stats]);

  // Fit again on another photo or a turn; the part redrawn from another photo goes
  useEffect(() => setView(FIT), [photo.id, rotation]);
  useEffect(() => setDetail((d) => (d && d.photoId !== photo.id ? null : d)), [photo.id]);

  // The area's size, and the screen's pixel density
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      setArea({ width: box.clientWidth, height: box.clientHeight });
      setPixelRatio(window.devicePixelRatio || 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const clamp = useCallback((v: View) => clampView(v, area, turned, pixelRatio), [area, turned, pixelRatio]);
  useEffect(() => setView((v) => clamp(v)), [clamp]);

  // The preview and the part redrawn from the original, corrected (or not, to compare)
  const previewStage = useMemo(
    () => corrected(preview, tables, settings.saturation, comparing), [preview, tables, settings.saturation, comparing]);
  const detailStage = useMemo(
    () => (detail && detail.photoId === photo.id ? corrected(detail.raw, tables, settings.saturation, comparing) : null),
    [detail, photo.id, tables, settings.saturation, comparing]);

  // Drawing: the turned photo at the view's scale, the sharper part over it, and the overview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || area.width === 0) return;
    canvas.width = Math.round(area.width * pixelRatio);
    canvas.height = Math.round(area.height * pixelRatio);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = scaleOf(view, area, turned);
    const t = rotationTransform(original.width, original.height, rotation);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.translate(area.width / 2, area.height / 2);
    ctx.scale(s, s);
    ctx.translate(-view.cx * turned.width, -view.cy * turned.height);
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    // Now in pixels of the original as opened
    ctx.drawImage(previewStage, 0, 0, original.width, original.height);
    if (detailStage && detail) {
      const r = detail.region;
      ctx.drawImage(detailStage, r.x, r.y, r.width, r.height);
    }
    if (view.zoom > 1.01) {
      // The overview, top left: the whole photo, and a frame round the part in view
      const k = OVERVIEW / Math.max(turned.width, turned.height);
      const w = turned.width * k, h = turned.height * k, m = 8;
      const o = rotationTransform(original.width * k, original.height * k, rotation);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.fillStyle = 'rgb(0 0 0 / 0.5)';
      ctx.fillRect(m - 2, m - 2, w + 4, h + 4);
      ctx.save();
      ctx.translate(m + o.x, m + o.y);
      ctx.rotate(o.angle);
      ctx.drawImage(previewStage, 0, 0, original.width * k, original.height * k);
      ctx.restore();
      const f = visibleFractions(view, area, turned);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'white';
      ctx.strokeRect(m + f.u0 * w, m + f.v0 * h, (f.u1 - f.u0) * w, (f.v1 - f.v0) * h);
    }
  }, [area, pixelRatio, view, turned, original, rotation, previewStage, detailStage, detail]);

  // Sharpness: once the view has settled zoomed in past the preview, ask for the part in view from the original
  useEffect(() => {
    if (area.width === 0) return;
    if (!needsDetail(view, area, turned, pixelRatio, preview.width / original.width)) return;
    let current = true;
    const timer = setTimeout(() => {
      const region = visibleRegion(view, area, original, rotation, turned);
      const out = detailSize(region, scaleOf(view, area, turned), pixelRatio);
      regionOf(photo.id, photo.file, region, out.width, out.height)
        .then((raw) => { if (current) setDetail({ photoId: photo.id, region, raw }); })
        .catch(() => { /* The preview stays: a little soft, but there */ });
    }, SETTLE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [view, area, turned, original, rotation, pixelRatio, preview.width, photo.id, photo.file]);

  // Zooming by the keyboard and the presets, toward the middle
  const zoomTo = useCallback(
    (zoom: number) => setView((v) => zoomAt(v, zoom, area.width / 2, area.height / 2, area, turned, pixelRatio)),
    [area, turned, pixelRatio]);
  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, v.zoom * factor, area.width / 2, area.height / 2, area, turned, pixelRatio));
  useShortcut('zoom-in', () => zoomBy(2));
  useShortcut('zoom-out', () => zoomBy(0.5));
  useShortcut('zoom-fit', () => setView(FIT));

  // Ctrl + scroll (and a trackpad pinch) zooms toward the pointer; scrolling pans when zoomed in
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey) {
        setView((v) => zoomAt(v, v.zoom * Math.exp(-e.deltaY * 0.01), x, y, area, turned, pixelRatio));
      } else {
        setView((v) => panBy(v, -e.deltaX, -e.deltaY, area, turned, pixelRatio));
      }
    };
    box.addEventListener('wheel', wheel, { passive: false });
    return () => box.removeEventListener('wheel', wheel);
  }, [area, turned, pixelRatio]);

  // Touch and mouse: what a press means is gestureStep's to say
  // (lib/gesture.ts); this feeds it the pointer events and acts on its answers
  const gesture = useRef<GestureState>(NO_GESTURE);
  const holdTimer = useRef(0);
  const pinchFrom = useRef(view);
  const viewNow = useRef(view);
  viewNow.current = view;

  // What gestureStep's answers do here: the hold timer and the callbacks;
  // what they do to the view is viewAfter's (lib/view-gestures.ts)
  const feed = (event: GestureEvent) => {
    const step = gestureStep(gesture.current, event);
    gesture.current = step.state;
    const c = { area, photo: turned, pixelRatio };
    for (const action of step.actions) {
      switch (action.type) {
        case 'start-hold-timer':
          clearTimeout(holdTimer.current);
          holdTimer.current = window.setTimeout(() => feed({ type: 'hold' }), HOLD_MS);
          break;
        case 'cancel-hold-timer':
          clearTimeout(holdTimer.current);
          break;
        case 'hold-start':
        case 'hold-end':
          onHold(action.type === 'hold-start');
          break;
        case 'pinch-start':
          pinchFrom.current = viewNow.current;
          break;
        case 'tap': {
          // The eyedropper, unless the tap landed in the margin
          const at = tapOnPhoto(action.x, action.y, viewNow.current, c);
          if (at) onTap(at[0], at[1]);
          break;
        }
        default:
          // A drag, a pinch or a double-tap. Each drag is added to the view
          // as it is now, which may be newer than the last render.
          setView((v) => viewAfter(action, v, pinchFrom.current, c));
      }
    }
  };

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div
      ref={boxRef}
      className={`relative h-full w-full touch-none ${armed ? 'cursor-crosshair' : view.zoom > 1.01 ? 'cursor-grab' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        feed({ type: 'down', ...local(e) });
      }}
      onPointerMove={(e) => feed({ type: 'move', ...local(e) })}
      // While the eyedropper is armed a tap samples, so it isn't half of a double-tap
      onPointerUp={(e) => feed({ type: 'up', ...local(e), time: Date.now(), doubleTaps: !armed })}
      onPointerCancel={(e) => feed({ type: 'cancel', id: e.pointerId })}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute bottom-2 right-2 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
        {PRESETS.map((p) => {
          const zoom = presetZoom(p, area, turned, pixelRatio);
          const active = Math.abs(view.zoom - Math.min(zoom, clamp({ ...view, zoom }).zoom)) < 0.01;
          return (
            <button
              key={p}
              type="button"
              onClick={() => (p === 'Fit' ? setView(FIT) : zoomTo(zoom))}
              className={`rounded-md px-2 py-1 text-xs font-medium shadow ${
                active ? 'bg-sky-600 text-white' : 'bg-white/80 text-slate-900 hover:bg-white'}`}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
