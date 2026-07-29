/**
 * 공유 액션 — 이미지 저장 / URL 복사 / (카톡은 kakao.ts).
 */

import { toBlob, toPng } from 'html-to-image';
import type { TypeCode } from '../content/schema';

/** 서브도메인 루트(acti.acttub.com)에 마운트하므로 prefix가 없다. */
export const BASE_PATH = '';

export type ShareChannel = 'story' | 'kakao' | 'link';

const SHARE_SOURCE: Record<ShareChannel, string> = {
  story: 'acti_story',
  kakao: 'acti_kakao',
  link: 'acti_link',
};

/** 채널 출처만 붙인 공유용 결과 URL. */
export function buildShareUrl(
  code: TypeCode,
  channel: ShareChannel,
  siteUrl = getSiteUrl()
): string {
  const baseUrl = siteUrl.replace(/\/+$/, '');
  return `${baseUrl}${BASE_PATH}/result/${code}?utm_source=${SHARE_SOURCE[channel]}`;
}

const PNG_OPTIONS = {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: '#F9FAFB',
  skipFonts: false,
} as const;

/** CaptureCard DOM을 PNG로 다운로드. */
export async function saveCaptureAsImage(
  node: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(node, PNG_OPTIONS);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export type InstagramShareResult = 'shared' | 'cancelled';

/**
 * 인스타 스토리 공유 가능 환경인지 판정.
 *
 * 필요 조건:
 *  1. 모바일 (iOS / Android) — 인스타 앱이 OS 공유시트에서 잡혀야 함
 *  2. Web Share API + 파일 첨부 지원
 *
 * 데스크탑 Chrome도 navigator.canShare({files})에 true를 줄 때가 있어서
 * UA 체크를 1차 게이트로 둠.
 */
export function canShareImageFile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (!isMobile) return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    const probe = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'probe.png', {
      type: 'image/png',
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** CaptureCard DOM을 공유용 PNG blob으로 렌더링. */
export async function renderCaptureBlob(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, PNG_OPTIONS);
  if (!blob) {
    throw new Error('Failed to render capture as image');
  }
  return blob;
}

/**
 * 미리 렌더링한 PNG blob을 인스타 스토리(또는 OS 공유시트)로 보냄.
 * 모바일 전용 — 호출 전에 canShareImageFile() 로 환경 확인할 것.
 */
export async function shareBlobToInstagram(
  blob: Blob,
  filename: string,
  shareText: string
): Promise<InstagramShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });

  try {
    await navigator.share({ files: [file], text: shareText });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    throw err;
  }
}

/**
 * 인스타 스토리(또는 OS 공유시트)로 캡처 카드 보내기.
 * 모바일 전용 — 호출 전에 canShareImageFile() 로 환경 확인할 것.
 */
export async function shareCaptureToInstagram(
  node: HTMLElement,
  filename: string,
  shareText: string
): Promise<InstagramShareResult> {
  const blob = await renderCaptureBlob(node);
  return shareBlobToInstagram(blob, filename, shareText);
}

/** 결과 URL을 클립보드에 복사. */
export async function copyResultUrl(code: TypeCode): Promise<void> {
  const url = buildShareUrl(code, 'link');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }
  // 폴백 (구형 브라우저)
  const ta = document.createElement('textarea');
  ta.value = url;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/** 원본 사이트 URL (OG, 카카오 공유에 사용) */
export function getSiteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
