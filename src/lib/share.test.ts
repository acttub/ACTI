import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const imageMocks = vi.hoisted(() => ({
  toBlob: vi.fn<(node: HTMLElement, options?: object) => Promise<Blob | null>>(),
  toPng: vi.fn<(node: HTMLElement, options?: object) => Promise<string>>(),
}));

vi.mock('html-to-image', () => imageMocks);

import {
  buildShareUrl,
  copyResultUrl,
  renderCaptureBlob,
  saveCaptureAsImage,
  shareBlobToInstagram,
  shareCaptureToInstagram,
} from './share';

describe('share URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(navigator, 'share');
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

describe('Instagram story image sharing', () => {
  const renderedBlob = new Blob(['png'], { type: 'image/png' });

  beforeEach(() => {
    imageMocks.toBlob.mockReset().mockResolvedValue(renderedBlob);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it('renders the capture as a 2x PNG blob', async () => {
    const node = document.createElement('section');

    await expect(renderCaptureBlob(node)).resolves.toBe(renderedBlob);

    expect(imageMocks.toBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        backgroundColor: '#F9FAFB',
        pixelRatio: 2,
      })
    );
  });

  it('throws when capture rendering does not produce a blob', async () => {
    imageMocks.toBlob.mockResolvedValue(null);

    await expect(renderCaptureBlob(document.createElement('section'))).rejects.toThrow(
      'Failed to render capture as image'
    );
  });

  it('shares the prepared PNG file and text through navigator.share', async () => {
    const nativeShare = vi.fn<(data?: ShareData) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      configurable: true,
    });

    await expect(
      shareBlobToInstagram(
        renderedBlob,
        'acti-MINB.png',
        'MINB 메이커 — https://acti.acttub.com/result/MINB?utm_source=acti_story'
      )
    ).resolves.toBe('shared');

    const shareData = nativeShare.mock.calls[0]?.[0];
    expect(shareData?.text).toContain(
      'https://acti.acttub.com/result/MINB?utm_source=acti_story'
    );
    expect(shareData?.files).toHaveLength(1);
    expect(shareData?.files?.[0]).toMatchObject({
      name: 'acti-MINB.png',
      type: 'image/png',
    });
  });

  it('returns cancelled only for an AbortError', async () => {
    const nativeShare = vi.fn<(data?: ShareData) => Promise<void>>(() =>
      Promise.reject(new DOMException('Cancelled', 'AbortError'))
    );
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      configurable: true,
    });

    await expect(
      shareBlobToInstagram(renderedBlob, 'acti-MINB.png', 'share text')
    ).resolves.toBe('cancelled');
  });

  it('rethrows non-cancellation sharing failures', async () => {
    const error = new DOMException('Denied', 'NotAllowedError');
    const nativeShare = vi.fn<(data?: ShareData) => Promise<void>>(() =>
      Promise.reject(error)
    );
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      configurable: true,
    });

    await expect(
      shareBlobToInstagram(renderedBlob, 'acti-MINB.png', 'share text')
    ).rejects.toBe(error);
  });

  it('keeps the combined sharing helper working for existing callers', async () => {
    const nativeShare = vi.fn<(data?: ShareData) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      configurable: true,
    });
    const node = document.createElement('section');

    await expect(
      shareCaptureToInstagram(node, 'acti-MINB.png', 'share text')
    ).resolves.toBe('shared');

    expect(imageMocks.toBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({ pixelRatio: 2 })
    );
    expect(nativeShare).toHaveBeenCalledTimes(1);
  });
});
