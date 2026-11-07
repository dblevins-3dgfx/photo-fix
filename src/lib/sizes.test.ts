import { describe, expect, it } from 'vitest';
import { CHROME_LIMIT, SAFARI_LIMIT, canvasPixelLimit, fitLongSide, fitUnderLimit, previewLongSide } from './sizes';

describe('Sizes', () => {
  it('the analysis image has its longer side at most 1024, never scaled up', () => {
    expect(fitLongSide(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitLongSide(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
    expect(fitLongSide(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
  it('the preview fits the screen at its pixel density, at most 2048', () => {
    expect(previewLongSide(390, 844, 3)).toBe(2048);
    expect(previewLongSide(1366, 768, 1)).toBe(1366);
  });
});

describe('Too large for the device', () => {
  it('scales down to the largest whole size under the limit, keeping proportions', () => {
    expect(fitUnderLimit(4800, 5033, SAFARI_LIMIT)).toEqual({ width: 4000, height: 4194, scaled: true });
    const big = fitUnderLimit(7200, 4800, SAFARI_LIMIT);
    expect(big.width * big.height).toBeLessThanOrEqual(SAFARI_LIMIT);
    expect(big.width / big.height).toBeCloseTo(1.5, 2);
  });
  it('leaves a photo within the limit alone', () => {
    expect(fitUnderLimit(4096, 4096, SAFARI_LIMIT)).toEqual({ width: 4096, height: 4096, scaled: false });
  });
  it('the limit is 4096 x 4096 in Safari and on an iPhone or iPad, larger in Chrome', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const chromeOnIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    const chromebook = 'Mozilla/5.0 (X11; CrOS x86_64 15359.58.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(canvasPixelLimit(iphone)).toBe(SAFARI_LIMIT);
    expect(canvasPixelLimit(chromeOnIphone)).toBe(SAFARI_LIMIT);
    expect(canvasPixelLimit(ipad, 5)).toBe(SAFARI_LIMIT);
    expect(canvasPixelLimit(chromebook)).toBe(CHROME_LIMIT);
  });
});
