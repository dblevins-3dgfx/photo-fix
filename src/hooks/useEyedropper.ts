// The White point eyedropper (SPEC.md section 4, White point): arming and
// disarming it, and sampling the analysis image where a tap landed.

import { useEffect, useState } from 'react';
import { buildTables } from '../lib/correction';
import * as words from '../lib/messages';
import { pixelAt, unrotatePoint } from '../lib/rotation';
import type { Gains } from '../lib/settings';
import { sampleBlock, whitePointGains } from '../lib/white-point';
import type { Photo } from '../photo';
import type { Status } from './useStatus';
import { useShortcut } from './useShortcut';

export function useEyedropper(photo: Photo | null, setWhitePoint: (gains: Gains) => void, status: Status) {
  const [armed, setArmed] = useState(false);
  // Changing photos disarms it
  const photoId = photo?.id;
  useEffect(() => setArmed(false), [photoId]);

  const arm = (on: boolean) => {
    setArmed(on);
    if (on) status.show(words.EYEDROPPER);
    else if (status.message === words.EYEDROPPER || status.message === words.TOO_DARK) status.show(null);
  };

  // A tap at (u, v), fractions of the turned photo's width and height
  const sample = (u: number, v: number) => {
    if (!photo) return;
    const { analysis, settings, stats } = photo;
    const [x, y] = unrotatePoint(u, v, settings.rotation);
    const [px, py] = pixelAt(x, y, analysis.width, analysis.height);
    const gains = whitePointGains(
      sampleBlock(analysis.data, analysis.width, analysis.height, px, py, buildTables(settings, stats, 'auto')));
    if (gains === 'too dark') {
      status.show(words.TOO_DARK);
      return;
    }
    setWhitePoint(gains);
    arm(false);
  };

  useShortcut('eyedropper', () => {
    if (!photo) return false;
    arm(!armed);
  });
  useShortcut('disarm', () => {
    if (!armed) return false;
    arm(false);
  });

  return { armed, toggle: () => arm(!armed), sample };
}
