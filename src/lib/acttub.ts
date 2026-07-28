/**
 * acttub 본 서비스로 넘기는 경로.
 *
 * acti 의 목적은 유형 진단 자체가 아니라 acttub 가입이라, 이 링크가 이 앱의
 * 유일한 전환 지점이다. 링크를 바꿀 일이 생기면 여기만 고친다.
 */

/** 도착한 쪽에서 출처를 구분할 수 있게 utm 을 붙인다. */
export const ACTTUB_URL =
  'https://acttub.com/?utm_source=acti&utm_medium=result&utm_campaign=acti_type';

/* 다만 acttub.com 은 소스 저장소가 특정되지 않아 우리가 계측을 못 붙인다 —
   utm 만 붙여 보내면 이 클릭이 어디에도 안 남는다. 그래서 나가는 순간을
   우리 쪽에서 세어 구글 시트에 남긴다. link.acttub.com/go 가 쓰는 것과 같은
   시트라 채널이 한 표에 모인다. */
const CORE_TRACK =
  'https://script.google.com/macros/s/AKfycbxmvQWyu-kslgIbVshJolG2KXV_omgT_vcUpmwJljvvYE8MkwUug-WGEhZmWUdU2ErK/exec';

export function trackCore(): void {
  // 로컬·프리뷰에서 눌러본 것이 실서비스 기록에 섞이면 그때부터 숫자를 못 믿는다.
  if (!/(^|\.)acttub\.com$/.test(location.hostname)) return;
  try {
    const body = JSON.stringify({
      type: 'click',
      at: new Date().toISOString(),
      from: 'acti',
      src: ACTTUB_URL.slice(ACTTUB_URL.indexOf('?')),
      ref: location.origin,
      click_id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    });
    // text/plain 이어야 preflight 없이 Apps Script가 받는다.
    // beacon이 false를 내면 "큐에 못 넣었다"는 뜻이라 keepalive fetch로 한 번 더 시도한다.
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    if (!(navigator.sendBeacon && navigator.sendBeacon(CORE_TRACK, blob))) {
      void fetch(CORE_TRACK, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        body,
      }).catch(() => {});
    }
  } catch {
    // 기록 실패가 이동을 막지 않도록 무시
  }
}

/** acttub 을 새 탭으로 연다. 트래킹이 실패해도 이동은 막지 않는다. */
export function openActtub(onGo?: () => void): void {
  trackCore();
  try {
    onGo?.();
  } catch {
    // 트래킹 실패가 이동을 막지 않도록 무시
  }
  window.open(ACTTUB_URL, '_blank', 'noopener,noreferrer');
}
