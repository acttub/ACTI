import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const imageMocks = vi.hoisted(() => ({
  toBlob: vi.fn<(node: HTMLElement, options?: object) => Promise<Blob | null>>(),
  toPng: vi.fn<(node: HTMLElement, options?: object) => Promise<string>>(),
}));

vi.mock('html-to-image', () => imageMocks);

import { buildShareUrl, copyResultUrl, saveCaptureAsImage } from './share';

describe('share URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it.each([
    ['story', 'acti_story'],
    ['kakao', 'acti_kakao'],
    ['link', 'acti_link'],
  ] as const)('builds a %s result URL with only utm_source', (channel, source) => {
    const url = new URL(buildShareUrl('MINB', channel, 'https://acti.acttub.com/'));

    expect(`${url.origin}${url.pathname}`).toBe('https://acti.acttub.com/result/MINB');
    expect(Array.from(url.searchParams.entries())).toEqual([['utm_source', source]]);
  });

  it('copies the tracked link-channel URL', async () => {
    vi.stubEnv('VITE_SITE_URL', '');
    const writeText = vi.fn<(data: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await copyResultUrl('MINB');

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/result/MINB?utm_source=acti_link`
    );
  });
});

describe('saveCaptureAsImage', () => {
  beforeEach(() => {
    imageMocks.toPng.mockReset().mockResolvedValue('data:image/png;base64,test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders at 2x and downloads the requested PNG filename', async () => {
    const node = document.createElement('section');
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('acti-MINB.png');
        expect(this.href).toBe('data:image/png;base64,test');
      });

    await saveCaptureAsImage(node, 'acti-MINB.png');

    expect(imageMocks.toPng).toHaveBeenCalledWith(
      node,
      expect.objectContaining({ pixelRatio: 2 })
    );
    expect(click).toHaveBeenCalledTimes(1);
  });
});
