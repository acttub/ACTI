import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getType } from '../content/types';

async function loadKakao() {
  vi.resetModules();
  return import('./kakao');
}

type KakaoSharePayload = {
  content: {
    imageUrl: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  };
  buttons: Array<{
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  }>;
};

describe('Kakao sharing', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KAKAO_APP_KEY', 'test-app-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(window, 'Kakao');
    vi.resetModules();
  });

  it('tracks both the result link and the landing button with acti_kakao', async () => {
    const sendDefault = vi.fn<(params: unknown) => void>();
    Object.defineProperty(window, 'Kakao', {
      value: {
        isInitialized: () => true,
        init: vi.fn(),
        Share: { sendDefault },
      },
      configurable: true,
    });
    const { shareToKakao } = await loadKakao();

    shareToKakao(getType('MINB'), 'https://acti.acttub.com/');

    expect(sendDefault).toHaveBeenCalledTimes(1);
    const [rawPayload] = sendDefault.mock.calls[0];
    const payload = rawPayload as KakaoSharePayload;
    const trackedResultUrl =
      'https://acti.acttub.com/result/MINB?utm_source=acti_kakao';
    const trackedAppUrl = 'https://acti.acttub.com?utm_source=acti_kakao';

    expect(payload.content.link).toEqual({
      mobileWebUrl: trackedResultUrl,
      webUrl: trackedResultUrl,
    });
    expect(payload.buttons[0].link).toEqual({
      mobileWebUrl: trackedAppUrl,
      webUrl: trackedAppUrl,
    });
    expect(payload.content.imageUrl).toBe('https://acti.acttub.com/og/MINB.jpg');
  });
});
