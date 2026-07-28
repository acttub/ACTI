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
import { openActtub, trackCore } from './acttub';

function stubBeacon(result: boolean) {
  const beacon = vi.fn(() => result);
  Object.defineProperty(navigator, 'sendBeacon', {
    value: beacon,
    configurable: true,
    writable: true,
  });
  return beacon;
}

/** beacon 이 실제로 실어 보낸 JSON. Blob 은 async 로만 읽힌다. */
async function sentPayload(beacon: ReturnType<typeof stubBeacon>) {
  const blob = beacon.mock.calls[0]?.[1] as unknown as Blob;
  return JSON.parse(await blob.text());
}

describe('코어 유입 계측', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('acttub 으로 나가는 클릭을 채널 이름과 함께 보낸다', async () => {
    const beacon = stubBeacon(true);

    trackCore();

    expect(beacon).toHaveBeenCalledTimes(1);
    const payload = await sentPayload(beacon);
    expect(payload.type).toBe('click');
    expect(payload.from).toBe('acti');
    expect(payload.ref).toBe('https://acti.acttub.com');
    // 사용자가 무엇을 골랐는지는 싣지 않는다 — 나갔다는 사실과 목적지 파라미터뿐이다.
    expect(Object.keys(payload).sort()).toEqual(
      ['at', 'click_id', 'from', 'ref', 'src', 'type'].sort()
    );
  });

  it('beacon 이 큐에 못 넣으면(false) fetch 로 한 번 더 시도한다', () => {
    const beacon = stubBeacon(false);
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);

    trackCore();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('script.google.com');
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
