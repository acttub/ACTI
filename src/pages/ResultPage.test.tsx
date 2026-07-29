import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shareMocks = vi.hoisted(() => ({
  canShareImageFile: vi.fn<() => boolean>(),
  copyResultUrl: vi.fn<(code: string) => Promise<void>>(),
  renderCaptureBlob:
    vi.fn<(node: HTMLElement) => Promise<Blob>>(),
  saveCaptureAsImage:
    vi.fn<(node: HTMLElement, filename: string) => Promise<void>>(),
  shareBlobToInstagram:
    vi.fn<
      (
        blob: Blob,
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
    renderCaptureBlob: shareMocks.renderCaptureBlob,
    saveCaptureAsImage: shareMocks.saveCaptureAsImage,
    shareBlobToInstagram: shareMocks.shareBlobToInstagram,
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

const captureBlob = new Blob(['png'], { type: 'image/png' });

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
    shareMocks.renderCaptureBlob.mockReset().mockResolvedValue(captureBlob);
    shareMocks.saveCaptureAsImage.mockReset().mockResolvedValue();
    shareMocks.shareBlobToInstagram.mockReset().mockResolvedValue('shared');
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
    expect(screen.getByText('이미지를 저장했어요 — 스토리 공유는 폰에서 돼요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shareMocks.renderCaptureBlob).not.toHaveBeenCalled();
    expect(shareMocks.shareBlobToInstagram).not.toHaveBeenCalled();
  });

  it('copies the story URL immediately, opens the guide, and starts capture before sharing', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    const writeText = installClipboard(() => new Promise<void>(() => {}));
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    const storyUrl = 'https://acti.acttub.com/result/MINB?utm_source=acti_story';
    expect(writeText).toHaveBeenCalledWith(storyUrl);
    expect(shareMocks.shareBlobToInstagram).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('스토리에 링크를 붙여주세요')).toBeInTheDocument();
    // 이 테스트의 클립보드는 영영 안 풀린다 — 복사됐다고 단언하면 안 된다.
    expect(
      screen.getByText('아래 링크를 복사해서 붙여야 친구가 탭해서 들어올 수 있어요.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('다음 화면에서 인스타그램 스토리를 고르세요')
    ).toBeInTheDocument();
    expect(
      screen.getByText('편집 화면에서 스티커 → 🔗 링크 를 누르세요')
    ).toBeInTheDocument();
    expect(screen.getByText('붙여넣기 하면 끝이에요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '나중에 할게요' })).toBeInTheDocument();

    await waitFor(() => {
      expect(shareMocks.renderCaptureBlob).toHaveBeenCalledWith(
        document.querySelector('.story-canvas')
      );
    });
    expect(shareMocks.shareBlobToInstagram).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '스토리로 보내기' }));

    await waitFor(() => {
      expect(shareMocks.shareBlobToInstagram).toHaveBeenCalledWith(
        captureBlob,
        'acti-MINB.png',
        expect.stringContaining(storyUrl)
      );
    });
    expect(analyticsMocks.trackResultAction).toHaveBeenCalledWith(
      'instagram_story',
      'MINB'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://acti.acttub.com/result/MINB'
      );
    });
  });

  it('keeps the guide available when the first clipboard write fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    installClipboard(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await waitFor(() => {
      expect(shareMocks.renderCaptureBlob).toHaveBeenCalledWith(
        document.querySelector('.story-canvas')
      );
    });
  });

  it('lets the URL box copy the tracked story URL again', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    const writeText = installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'URL 복사' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenLastCalledWith(
        'https://acti.acttub.com/result/MINB?utm_source=acti_story'
      );
    });
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('closes quietly without tracking or saving when story sharing is cancelled', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareBlobToInstagram.mockResolvedValue('cancelled');
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);
    fireEvent.click(await screen.findByRole('button', { name: '스토리로 보내기' }));

    await waitFor(() => {
      expect(shareMocks.shareBlobToInstagram).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('공유가 안 돼서 이미지로 저장했어요')).not.toBeInTheDocument();
    expect(shareMocks.saveCaptureAsImage).not.toHaveBeenCalled();
    expect(analyticsMocks.trackResultAction).not.toHaveBeenCalled();
  });

  it('saves the image and shows a toast when navigator sharing fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareBlobToInstagram.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError')
    );
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);
    fireEvent.click(await screen.findByRole('button', { name: '스토리로 보내기' }));

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

  it('falls back to saving and shows a toast when capture rendering fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.renderCaptureBlob.mockRejectedValue(new Error('capture failed'));
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);
    fireEvent.click(await screen.findByRole('button', { name: '스토리로 보내기' }));

    expect(
      await screen.findByText('공유가 안 돼서 이미지로 저장했어요')
    ).toBeInTheDocument();
    expect(shareMocks.shareBlobToInstagram).not.toHaveBeenCalled();
    expect(shareMocks.saveCaptureAsImage).toHaveBeenCalledWith(
      document.querySelector('.story-canvas'),
      'acti-MINB.png'
    );
  });

  it('does not claim the image was saved when the fallback save also fails', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    shareMocks.shareBlobToInstagram.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError')
    );
    shareMocks.saveCaptureAsImage.mockRejectedValue(new Error('save failed'));
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);
    fireEvent.click(await screen.findByRole('button', { name: '스토리로 보내기' }));

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

  it('says the link is copied only after the clipboard write actually resolves', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    installClipboard();
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(
      await screen.findByText('링크는 복사해뒀어요. 붙여넣기만 하면 친구가 탭해서 들어올 수 있어요.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('아래 링크를 복사해서 붙여야 친구가 탭해서 들어올 수 있어요.')
    ).not.toBeInTheDocument();
  });

  it('does not claim the link is copied when the browser has no clipboard API', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    Reflect.deleteProperty(navigator, 'clipboard');
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('아래 링크를 복사해서 붙여야 친구가 탭해서 들어올 수 있어요.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('링크는 복사해뒀어요. 붙여넣기만 하면 친구가 탭해서 들어올 수 있어요.')
    ).not.toBeInTheDocument();
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

  it('still opens the guide when the browser has no clipboard API', async () => {
    shareMocks.canShareImageFile.mockReturnValue(true);
    // 인앱 브라우저 등 clipboard 가 없는 환경 — 여기서 터지면 공유 자체가 막힌다.
    Reflect.deleteProperty(navigator, 'clipboard');
    render(resultRoute());

    const storyButton = await screen.findByRole('button', { name: '스토리' });
    markStoryImageAsLoaded();
    fireEvent.click(storyButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '스토리로 보내기' }));

    await waitFor(() => {
      expect(shareMocks.shareBlobToInstagram).toHaveBeenCalled();
    });
  });
});
