/**
 * Kakao JS SDK v2 래퍼.
 *
 * - index.html 의 외부 스크립트로 window.Kakao 가 로드되어 있음
 * - 앱 키는 .env.local 의 VITE_KAKAO_APP_KEY (미설정 시 공유 비활성)
 */

import type { TypeContent } from '../content/schema';
import { BASE_PATH, buildShareUrl } from './share';

type KakaoSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: {
    sendDefault: (params: unknown) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

const APP_KEY = import.meta.env.VITE_KAKAO_APP_KEY as string | undefined;

/** 빌드 시점에 앱 키가 있는지. 없으면 공유 버튼 자체를 화면에 그리지 않는다 —
 *  눌러도 아무 일이 없는 버튼을 노출하는 것보다는 안 보이는 게 낫다. */
export const isKakaoConfigured = Boolean(APP_KEY);

/** 멱등 초기화. 호출 시 SDK 사용 가능 여부 반환. */
export function ensureKakaoReady(): boolean {
  if (typeof window === 'undefined' || !window.Kakao) return false;
  if (!APP_KEY) return false;
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(APP_KEY);
  }
  return window.Kakao.isInitialized();
}

/** 카카오톡 공유 (피드 카드 형식). */
export function shareToKakao(type: TypeContent, siteUrl: string): void {
  if (!ensureKakaoReady() || !window.Kakao) {
    console.warn('Kakao SDK not ready');
    return;
  }
  const baseUrl = `${siteUrl.replace(/\/+$/, '')}${BASE_PATH}`;
  const appUrl = `${baseUrl}?utm_source=acti_kakao`;
  const resultUrl = buildShareUrl(type.code, 'kakao', siteUrl);
  const imageUrl = `${baseUrl}/og/${type.code}.jpg`;

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `[${type.code}] ${type.name}`,
      description: type.tagline,
      imageUrl,
      link: { mobileWebUrl: resultUrl, webUrl: resultUrl },
    },
    buttons: [
      {
        title: '나도 풀어보기',
        link: { mobileWebUrl: appUrl, webUrl: appUrl },
      },
    ],
  });
}
