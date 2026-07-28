/**
 * 로컬·프리뷰에서 눌러본 클릭이 실서비스 유입 기록에 섞이지 않는지.
 *
 * 이 가드가 풀리면 QA 하려고 버튼을 누를 때마다 시트에 행이 쌓여서, 나중에
 * "몇 명이 코어로 넘어갔나"를 세는 숫자가 우리가 만든 클릭과 섞인다.
 *
 * 별도 파일인 이유: jsdom 의 location 은 바꿔 끼울 수 없어 호스트를 파일 단위로만
 * 정할 수 있다. 여기는 기본값(localhost)을 그대로 쓴다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackCore } from './acttub';

describe('코어 유입 계측 — 실서비스 밖', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('acttub.com 이 아닌 곳에서는 아무것도 보내지 않는다', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
      writable: true,
    });
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetchMock);

    expect(location.hostname).toBe('localhost');
    trackCore();

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
