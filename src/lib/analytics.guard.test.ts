/**
 * 로컬·프리뷰에서 GA 태그가 아예 뜨지 않는지.
 *
 * 이 가드가 풀리면 개발하면서 새로고침한 것까지 실서비스 통계에 쌓여서, 나중에
 * "몇 명이 왔나"를 세는 숫자가 우리가 만든 방문과 섞인다. 화면은 멀쩡해서 아무도 모른다.
 *
 * 별도 파일인 이유: jsdom 의 location 은 바꿔 끼울 수 없어 호스트를 파일 단위로만
 * 정할 수 있다. 여기는 기본값(localhost)을 그대로 쓴다 — 정상 경로는 analytics.test.ts 가 본다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GA 계측 — 실서비스 밖', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
    delete window.dataLayer;
    delete window.gtag;
    vi.resetModules();
  });

  it('acttub.com 이 아닌 곳에서는 측정 ID가 있어도 태그를 로드하지 않는다', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
    const { initAnalytics } = await import('./analytics');

    expect(location.hostname).toBe('localhost');
    initAnalytics();

    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it('lazy-init 경로로도 새어나가지 않는다', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
    const { trackPageView, trackResultAction } = await import('./analytics');

    // initAnalytics 를 부르지 않고 바로 추적을 시도한다 — ensureReady 가 self-init 하는 경로다.
    trackPageView('/quiz');
    trackResultAction('acttub_cta', 'MINB');

    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });
});
