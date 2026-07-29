import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shareMocks = vi.hoisted(() => ({
  canShareImageFile: vi.fn<() => boolean>(),
  copyResultUrl: vi.fn<(code: string) => Promise<void>>(),
  saveCaptureAsImage:
    vi.fn<(node: HTMLElement, filename: string) => Promise<void>>(),
  shareCaptureToInstagram:
    vi.fn<
      (
        node: HTMLElement,
        filename: string,
        shareText: string
      ) => Promise<'shared' | 'cancelled'>
    >(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackResultAction: vi.fn<(action: string, resultCode: string) => void>(),
}));

vi.mock('../lib/share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/share')>();
  return {
    ...actual,
    canShareImageFile: shareMocks.canShareImageFile,
    copyResultUrl: shareMocks.copyResultUrl,
    getSiteUrl: () => 'https://acti.acttub.com',
    saveCaptureAsImage: shareMocks.saveCaptureAsImage,
    shareCaptureToInstagram: shareMocks.shareCaptureToInstagram,
  };
});

vi.mock('../lib/analytics', () => analyticsMocks);

vi.mock('../lib/kakao', () => ({
  ensureKakaoReady: vi.fn(() => true),
  isKakaoConfigured: false,
  shareToKakao: vi.fn(),
}));

vi.mock('../lib/acttub', () => ({
  openActtub: vi.fn(),
}));

import ResultPage from './ResultPage';

function resultRoute() {
  return (
    <HelmetProvider>
      <MemoryRouter initialEntries={['/result/MINB?utm_source=acti_link']}>
        <Routes>
          <Route path="/result/:code" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

function markStoryImageAsLoaded() {
  const image = document.querySelector<HTMLImageElement>('.story-canvas__avatar');
  expect(image).not.toBeNull();
  Object.defineProperties(image!, {
    complete: { value: true, configurable: true },
    naturalWidth: { value: 200, configurable: true },
  });
}

describe('ResultPage sharing', () => {
  beforeEach(() => {
    window.localStorage.setItem('myTypeCode', 'MINB');
    shareMocks.canShareImageFile.mockReset();
    shareMocks.copyResultUrl.mockReset().mockResolvedValue();
    shareMocks.saveCaptureAsImage.mockReset().mockResolvedValue();
    shareMocks.shareCaptureToInstagram.mockReset().mockResolvedValue('shared');
    analyticsMocks.trackResultAction.mockReset();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.head.innerHTML = '';
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('keeps the prerendered first label as story without reading the UA during render', () => {
    shareMocks.canShareImageFile.mockReturnValue(false);

    const html = renderToString(resultRoute());

    expect(html).toContain('aria-label="스토리"');
    expect(shareMocks.canShareImageFile).not.toHaveBeenCalled();
  });

  it('saves the story canvas on desktop and does not open the story modal', async () => {
    shareMocks.canShareImageFile.mockReturnValue(false);
    render(resultRoute());

    const saveButton = await screen.findByRole('button', { name: '이미지 저장' });
    markStoryImageAsLoaded();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
        document.querySelector('.story-canvas'),
        'acti-MINB.png'
      );
    });
    expect(analyticsMocks.trackResultAction).toHaveBeenCalledWith('save_image', 'MINB');
    expect(screen.getByText('이미지를 저장했어요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shareMocks.shareCaptureToInstagram).not.toHaveBeenCalled();
  });

  it('keeps mobile story sharing, passes the tracked URL, and leaves og:url canonical', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    const writeText = vi.fn<(data: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    const storyUrl = 'https://acti.acttub.com/result/MINB?utm_source=acti_story';
    await waitFor(() => {
      expect(shareMocks.shareCaptureToInstagram).toHaveBeenCalledWith(
        document.querySelector('.story-canvas'),
        'acti-MINB.png',
        expect.stringContaining(storyUrl)
      );
    });
    expect(analyticsMocks.trackResultAction).toHaveBeenCalledWith(
      'instagram_story',
      'MINB'
    );
    expect(screen.getByText(storyUrl)).toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'URL 복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(storyUrl));

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://acti.acttub.com/result/MINB'
      );
    });
  });
});
