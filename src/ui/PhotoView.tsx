import { useEffect, useMemo, useRef } from 'react';
import { applyCorrection, buildTables } from '../lib/correction';
import { rotatedSize, rotationTransform } from '../lib/rotation';
import type { Photo } from '../photo';

const HOLD_MS = 350;

// The photo area (SPEC.md section 5): the corrected preview, turned and
// fitted without cropping. Press and hold compares; with the eyedropper
// armed, a short tap reports where it landed, as fractions of the turned
// photo's width and height.
export default function PhotoView({ photo, comparing, armed, onTap, onHold }: {
  photo: Photo;
  comparing: boolean;
  armed: boolean;
  onTap: (u: number, v: number) => void;
  onHold: (held: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staging = useRef<HTMLCanvasElement | null>(null);
  const corrected = useRef<ImageData | null>(null);
  const { settings, preview, stats } = photo;
  const tables = useMemo(() => buildTables(settings, stats), [settings, stats]);
  const size = rotatedSize(preview.width, preview.height, settings.rotation);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!staging.current) staging.current = document.createElement('canvas');
    const stage = staging.current;
    stage.width = preview.width;
    stage.height = preview.height;
    let image = preview;
    if (!comparing) {
      if (corrected.current?.width !== preview.width || corrected.current?.height !== preview.height) {
        corrected.current = new ImageData(preview.width, preview.height);
      }
      applyCorrection(preview.data, corrected.current.data, tables, settings.saturation);
      image = corrected.current;
    }
    stage.getContext('2d')!.putImageData(image, 0, 0);
    const ctx = canvas.getContext('2d')!;
    const t = rotationTransform(preview.width, preview.height, settings.rotation);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.drawImage(stage, 0, 0);
  }, [preview, tables, settings.saturation, settings.rotation, comparing, size.width, size.height]);

  const hold = useRef<{ timer: number; held: boolean } | null>(null);
  const end = () => {
    if (!hold.current) return false;
    clearTimeout(hold.current.timer);
    const held = hold.current.held;
    hold.current = null;
    if (held) onHold(false);
    return held;
  };

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className={`max-h-full max-w-full touch-none ${armed ? 'cursor-crosshair' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        end();
        e.currentTarget.setPointerCapture(e.pointerId);
        const h = { timer: 0, held: false };
        h.timer = window.setTimeout(() => {
          h.held = true;
          onHold(true);
        }, HOLD_MS);
        hold.current = h;
      }}
      onPointerUp={(e) => {
        if (end() || !armed) return;
        const r = e.currentTarget.getBoundingClientRect();
        onTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }}
      onPointerCancel={end}
    />
  );
}
