/**
 * 코어(acttub.com)로 나가는 클릭을 유입 기록 시트로 보내는 부분.
 *
 * acttub.com 은 우리 저장소가 아니라 도착을 볼 수 없다. 이 beacon 이 조용히 죽으면
 * "acti 를 보고 코어로 넘어간 사람"이 통째로 0이 되는데, 화면은 멀쩡해서 아무도 모른다.
 * 그래서 발사 여부를 테스트로 고정한다.
 *
 * 이 파일은 실서비스 호스트를 흉내낸다 — 로컬에서 눌러본 것을 걸러내는 가드가 있어서,
 * jsdom 기본 주소(localhost)로 두면 아래 테스트가 전부 통과하지 못한다.
 *
 * @vitest-environment-options { "url": "https://acti.acttub.com/result" }
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openActtub,
  resetResultViewTracking,
  trackCore,
  trackEvent,
  trackResultView,
} from './acttub';

function stubBeacon(result: boolean) {
  // 타입을 sendBeacon 으로 못박아야 mock.calls 에서 인자를 꺼낼 때 타입이 산다.
  const beacon = vi.fn<typeof navigator.sendBeacon>(() => result);
  Object.defineProperty(navigator, 'sendBeacon', {
    value: beacon,
    configurable: true,
    writable: true,
  });
  return beacon;
}

/** beacon 이 실제로 실어 보낸 JSON. Blob 은 async 로만 읽힌다. */
async function sentPayload(beacon: ReturnType<typeof stubBeacon>) {
  const [, data] = beacon.mock.calls[0];
  return JSON.parse(await (data as Blob).text());
}

async function sentEventNames(beacon: ReturnType<typeof stubBeacon>) {
  return Promise.all(
    beacon.mock.calls.map(async ([, data]) => {
      const payload = JSON.parse(await (data as Blob).text());
      return payload.name;
    })
  );
}

describe('코어 유입 계측', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'sendBeacon');
    window.sessionStorage.removeItem('acti_upstream');
    resetResultViewTracking();
  });

  it('acttub 으로 나가는 클릭을 채널 이름과 함께 보낸다', async () => {
    const beacon = stubBeacon(true);

    trackCore();

    expect(beacon).toHaveBeenCalledTimes(1);
    const payload = await sentPayload(beacon);
    expect(payload.type).toBe('click');
    expect(payload.from).toBe('acti');
    expect(payload.ref).toBe('https://acti.acttub.com');
    // 원 채널을 못 잡았을 때는 direct로 남는다(이 테스트 환경엔 utm_source도
    // referrer도 없다).
    expect(payload.upstream).toBe('direct');
    // 사용자가 무엇을 골랐는지는 싣지 않는다 — 나갔다는 사실과 목적지 파라미터뿐이다.
    expect(Object.keys(payload).sort()).toEqual(
      ['at', 'click_id', 'from', 'ref', 'src', 'type', 'upstream'].sort()
    );
  });

  it('링크·referrer로 잡아둔 원 채널을 payload와 코어 링크 양쪽에 싣는다', async () => {
    window.sessionStorage.setItem('acti_upstream', 'linkhub');
    const beacon = stubBeacon(true);

    trackCore();
    openActtub();

    const payload = await sentPayload(beacon);
    expect(payload.upstream).toBe('linkhub');

    // 기존 utm_source=acti는 덮어쓰지 않고 utm_term만 더한다.
    const [openedUrl] = vi.mocked(window.open).mock.calls[0];
    const params = new URL(String(openedUrl)).searchParams;
    expect(params.get('utm_source')).toBe('acti');
    expect(params.get('utm_term')).toBe('linkhub');
  });

  it('beacon 이 큐에 못 넣으면(false) fetch 로 한 번 더 시도한다', () => {
    const beacon = stubBeacon(false);
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);

    trackCore();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('script.google.com');
  });

  it('퍼널 이벤트는 발생할 때마다 최소 payload로 보낸다', async () => {
    const beacon = stubBeacon(true);

    trackEvent('landing_view');
    trackEvent('landing_view');

    expect(beacon).toHaveBeenCalledTimes(2);
    const payload = await sentPayload(beacon);
    expect(payload).toMatchObject({
      type: 'event',
      app: 'acti',
      name: 'landing_view',
    });
    expect(payload.at).toEqual(expect.any(String));
    expect(Object.keys(payload).sort()).toEqual(['app', 'at', 'name', 'type']);
  });

  it('같은 결과의 연속 재렌더는 건너뛰고 새 퀴즈 결과는 다시 보낸다', async () => {
    const beacon = stubBeacon(true);

    trackResultView('MINB');
    trackResultView('MINB');

    // result_view + result_minb 한 쌍만 전송된다.
    expect(beacon).toHaveBeenCalledTimes(2);
    expect(await sentEventNames(beacon)).toEqual(['result_view', 'result_minb']);

    resetResultViewTracking();
    trackResultView('MINB');

    // 같은 결과 코드여도 새 퀴즈에서 만든 결과면 한 쌍을 다시 전송한다.
    expect(beacon).toHaveBeenCalledTimes(4);
    expect(await sentEventNames(beacon)).toEqual([
      'result_view',
      'result_minb',
      'result_view',
      'result_minb',
    ]);
  });

  it('기록이 실패해도 acttub 은 열린다', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: () => {
        throw new Error('beacon 없음');
      },
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch 없음');
    });

    openActtub();

    expect(window.open).toHaveBeenCalledTimes(1);
  });
});
