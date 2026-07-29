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

const storyHint =
  '스토리에 올릴 땐 스티커 → 🔗 링크 를 붙여주세요. 링크는 복사해둘게요.';
const storyUrl = 'https://acti.acttub.com/result/MINB?utm_source=acti_story';

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

function installClipboard(
  implementation: (data: string) => Promise<void> = () => Promise.resolve()
) {
  const writeText = vi.fn<(data: string) => Promise<void>>(implementation);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
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

  it('saves the story canvas on desktop and hides the mobile story hint', async () => {
    shareMocks.canShareImageFile.mockReturnValue(false);
    render(resultRoute());

    const saveButton = await screen.findByRole('button', { name: '이미지 저장' });
    expect(screen.queryByText(storyHint)).not.toBeInTheDocument();
    markStoryImageAsLoaded();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
        document.querySelector('.story-canvas'),
        'acti-MINB.png'
      );
    });
    expect(analyticsMocks.trackResultAction).toHaveBeenCalledWith('save_image', 'MINB');
    expect(screen.getByText('이미지를 저장했어요 — 스토리 공유는 폰에서 돼요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shareMocks.shareCaptureToInstagram).not.toHaveBeenCalled();
  });

  it('copies immediately and opens the OS sharing flow from one mobile click', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    const writeText = installClipboard(() => new Promise<void>(() => {}));
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    expect(screen.getByText(storyHint)).toBeInTheDocument();
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    // 클립보드 프로미스가 영영 안 풀려도 공유를 막지 않으며 클릭 호출 스택에서 즉시 실행된다.
    expect(writeText).toHaveBeenCalledWith(storyUrl);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

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
    expect(shareMocks.saveCaptureAsImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://acti.acttub.com/result/MINB'
      );
    });
  });

  it('continues directly to sharing when the browser has no clipboard API', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    Reflect.deleteProperty(navigator, 'clipboard');
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does nothing when story sharing is cancelled', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareCaptureToInstagram.mockResolvedValue('cancelled');
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    await waitFor(() => {
      expect(shareMocks.shareCaptureToInstagram).toHaveBeenCalled();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).not.toHaveBeenCalled();
    expect(analyticsMocks.trackResultAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves the image and shows a toast when navigator sharing fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareCaptureToInstagram.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError')
    );
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(
      await screen.findByText('공유가 안 돼서 이미지로 저장했어요')
    ).toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
      document.querySelector('.story-canvas'),
      'acti-MINB.png'
    );
    expect(analyticsMocks.trackResultAction).toHaveBeenCalledWith('save_image', 'MINB');
    expect(analyticsMocks.trackResultAction).not.toHaveBeenCalledWith(
      'instagram_story',
      'MINB'
    );
  });

  it('falls back to saving when capture rendering fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareCaptureToInstagram.mockRejectedValue(new Error('capture failed'));
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(
      await screen.findByText('공유가 안 돼서 이미지로 저장했어요')
    ).toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
      document.querySelector('.story-canvas'),
      'acti-MINB.png'
    );
  });

  it('does not claim the image was saved when the fallback save also fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareCaptureToInstagram.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError')
    );
    shareMocks.saveCaptureAsImage.mockRejectedValue(new Error('save failed'));
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(
      await screen.findByText('공유가 안 됐어요. 잠시 뒤 다시 해주세요')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('공유가 안 돼서 이미지로 저장했어요')
    ).not.toBeInTheDocument();
    expect(analyticsMocks.trackResultAction).not.toHaveBeenCalledWith(
      'save_image',
      'MINB'
    );
  });

  it('does not hang when a capture image already failed to load', async () => {
    shareMocks.canShareImageFile.mockReturnValue(false);
    render(resultRoute());

    const saveButton = await screen.findByRole('button', { name: '이미지 저장' });
    // 이미 실패한 이미지: complete 는 true 인데 naturalWidth 는 0 이다.
    // load/error 는 이미 지나갔으므로 그걸 기다리면 영영 안 풀린다.
    const image = document.querySelector<HTMLImageElement>('.story-canvas__avatar');
    Object.defineProperties(image!, {
      complete: { value: true, configurable: true },
      naturalWidth: { value: 0, configurable: true },
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
        document.querySelector('.story-canvas'),
        'acti-MINB.png'
      );
    });
    expect(await screen.findByText('이미지를 저장했어요 — 스토리 공유는 폰에서 돼요')).toBeInTheDocument();
  });
});
