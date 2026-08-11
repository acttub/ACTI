const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

type GtagCommand = [command: string, ...args: unknown[]];

/**
 * 결과 페이지의 사용자 액션. 발사 시점은 액션마다 다름:
 * - `acttub_cta`: acttub 이동 버튼 클릭 시 (의도) — 새 탭 이동이라 도착은 알 수 없음
 * - `instagram_story`: Web Share API가 `'shared'` 반환 시 (확정)
 * - `save_image`: 이미지 다운로드를 시작한 뒤 (확정)
 * - `copy_link`: 클립보드 쓰기 성공 후 (확정)
 * - `kakao_share`: Kakao SDK 호출 후 (의도) — SDK가 완료 콜백을 제공하지 않아
 *   팝업 오픈 = 추적. 사용자가 팝업을 닫아도 이벤트는 발사됨.
 */
export type ResultAction =
  | 'acttub_cta'
  | 'instagram_story'
  | 'save_image'
  | 'kakao_share'
  | 'copy_link';

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: GtagCommand) => void;
  }
}

// 모듈 스코프 — React StrictMode dev의 시뮬레이션된 remount는 컴포넌트 ref를
// 재초기화하므로 dedupe 상태는 컴포넌트 밖에 둬야 한다.
let lastTrackedPath: string | null = null;

export function initAnalytics(): void {
  const measurementId = GA_MEASUREMENT_ID;
  if (!measurementId) return;
  // 로컬·프리뷰에서 새로고침한 것까지 실서비스 통계에 쌓이면 "몇 명이 왔나"를 못 믿는다.
  // 유입 기록 beacon(acttub.ts)과 형제 서브프로젝트 5개가 쓰는 것과 같은 가드다.
  if (!/(^|\.)acttub\.com$/.test(location.hostname)) return;

  const existingScript = document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"]`
  );
  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  if (window.gtag) return;

  window.dataLayer = window.dataLayer || [];
  // gtag.js queue consumer expects the native arguments object, not an array — see google's snippet.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer?.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
}

/** ID는 설정됐는데 gtag가 아직 없으면 self-init 시도. */
function ensureReady(): boolean {
  if (!GA_MEASUREMENT_ID) return false;
  if (!window.gtag) initAnalytics();
  return Boolean(window.gtag);
}

/**
 * 입력 path를 안전한 pathname으로 정규화.
 * - 결과 URL의 origin이 현재 페이지와 다르면 거부 (`http://evil.com/x`,
 *   `//evil.com/x` 등 외부 origin으로 해석되는 모든 입력).
 * - leading slash 없는 상대 path는 URL 파서가 보정.
 * - `new URL()` 실패는 null.
 */
function normalizePath(path: string): string | null {
  if (path.startsWith('//')) return null;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/**
 * SPA 페이지뷰 추적. `path`는 `/`로 시작하는 pathname을 기대하지만,
 * 그렇지 않은 입력도 안전하게 처리. 동일 path 연속 호출은 dedupe.
 */
export function trackPageView(path: string): void {
  if (!ensureReady()) return;

  const pagePath = normalizePath(path);
  if (pagePath === null) return;
  if (lastTrackedPath === pagePath) return;
  lastTrackedPath = pagePath;

  window.gtag?.('event', 'page_view', {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: document.title,
  });
}

export function trackResultAction(action: ResultAction, resultCode: string): void {
  if (!ensureReady()) return;

  window.gtag?.('event', 'result_action_request', {
    action,
    result_code: resultCode,
  });

  /* 형제 서브프로젝트 6개는 코어 버튼 클릭을 `acttub_cta` + `from` 한 쌍으로 쏜다.
     acti 만 이름이 달라 GA4 에서 "코어로 몇 명이 넘어갔나"를 한 표로 볼 때 혼자
     빠졌다. 위 이벤트는 이미 쌓인 데이터가 있으니 그대로 두고, 코어 클릭일 때만
     형제들과 같은 모양으로 한 번 더 보낸다. */
  if (action === 'acttub_cta') {
    window.gtag?.('event', 'acttub_cta', { from: 'acti' });
  }
}
