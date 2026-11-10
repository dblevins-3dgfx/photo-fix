import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShortcut } from '../hooks/useShortcut';
import { applyCorrection, buildTables, type Tables } from '../lib/correction';
import { rotatedSize, rotationTransform } from '../lib/rotation';
import {
  FIT, PRESETS, clampView, detailSize, needsDetail, panBy, presetZoom, scaleOf, toPhoto, visibleFractions, visibleRegion,
  zoomAt, type Size, type View,
} from '../lib/view';
import { regionOf, type Region } from '../detail';
import type { Photo } from '../photo';

const HOLD_MS = 350;
const DOUBLE_TAP_MS = 300;
// A touch that moves less than this is a tap (or a hold), not a drag
const SLOP = 8;
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

  // Touch and mouse: tap, double-tap, hold, drag and pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: 'one' | 'pinch' | 'done';
    start: { x: number; y: number };
    last: { x: number; y: number };
    moved: boolean;
    held: boolean;
    timer: number;
    pinch?: { d0: number; mid0: { x: number; y: number }; view0: View };
  } | null>(null);
  const lastTap = useRef(0);

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchOf = () => {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  const stopHold = () => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.held) {
      g.held = false;
      onHold(false);
    }
  };

  const viewNow = useRef(view);
  viewNow.current = view;

  return (
    <div
      ref={boxRef}
      className={`relative h-full w-full touch-none ${armed ? 'cursor-crosshair' : view.zoom > 1.01 ? 'cursor-grab' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        pointers.current.set(e.pointerId, p);
        if (pointers.current.size === 1) {
          const g = { mode: 'one' as const, start: p, last: p, moved: false, held: false, timer: 0 };
          g.timer = window.setTimeout(() => {
            g.held = true;
            onHold(true);
          }, HOLD_MS);
          gesture.current = g;
        } else if (pointers.current.size === 2) {
          stopHold();
          const { d, mid } = pinchOf();
          gesture.current = {
            mode: 'pinch', start: mid, last: mid, moved: true, held: false, timer: 0,
            pinch: { d0: d, mid0: mid, view0: viewNow.current },
          };
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        const p = local(e);
        pointers.current.set(e.pointerId, p);
        const g = gesture.current;
        if (!g) return;
        if (g.mode === 'one') {
          if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > SLOP) {
            g.moved = true;
            if (!g.held) clearTimeout(g.timer);
          }
          if (g.moved && !g.held) setView((v) => panBy(v, p.x - g.last.x, p.y - g.last.y, area, turned, pixelRatio));
          g.last = p;
        } else if (g.mode === 'pinch' && g.pinch && pointers.current.size === 2) {
          const { d, mid } = pinchOf();
          const { d0, mid0, view0 } = g.pinch;
          const zoomed = zoomAt(view0, view0.zoom * (d / d0), mid0.x, mid0.y, area, turned, pixelRatio);
          setView(panBy(zoomed, mid.x - mid0.x, mid.y - mid0.y, area, turned, pixelRatio));
        }
      }}
      onPointerUp={(e) => {
        const p = local(e);
        pointers.current.delete(e.pointerId);
        const g = gesture.current;
        if (!g) return;
        if (g.mode === 'one' && pointers.current.size === 0) {
          const wasHeld = g.held;
          stopHold();
          gesture.current = null;
          if (wasHeld || g.moved) return;
          if (armed) {
            const [u, v] = toPhoto(viewNow.current, p.x, p.y, area, turned);
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) onTap(u, v);
            return;
          }
          // Double-tap: in to 2x around the point, or back to Fit
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            setView((v) => (v.zoom > 1.01 ? FIT : zoomAt(v, 2, p.x, p.y, area, turned, pixelRatio)));
          } else {
            lastTap.current = now;
          }
        } else if (pointers.current.size === 0) {
          gesture.current = null;
        } else {
          // One finger left after a pinch: nothing more until it lifts too
          g.mode = 'done';
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        stopHold();
        if (pointers.current.size === 0) gesture.current = null;
      }}
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
