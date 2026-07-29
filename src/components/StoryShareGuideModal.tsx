/** StoryShareGuideModal — 인스타 스토리 공유 전 링크 스티커 안내 모달. */

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import './StoryShareGuideModal.css';

type Props = {
  url: string;
  /** 모달을 열 때 자동 복사가 실제로 성공했는지. 실패했으면 사용자가 직접 복사해야 한다. */
  copied: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
};

export default function StoryShareGuideModal({ url, copied, onConfirm, onClose }: Props) {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 1500);
    } catch {
      // ignore — 토스트 띄우기엔 부담이라 조용히 실패
    }
  };

  return (
    <div className="share-modal__backdrop" onClick={onClose} role="presentation">
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <button
          type="button"
          className="share-modal__close"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        {/* 자동 복사는 클립보드가 없는 인앱 브라우저에서 조용히 실패한다.
            제목이 "복사해뒀어요"라고 단언하면 그 경우 거짓말이 되므로, 복사 여부와
            무관하게 참인 문장을 제목에 두고 실제 상태는 아래 복사 버튼이 보여준다. */}
        <h3 id="share-modal-title" className="share-modal__title">
          스토리에 링크를 붙여주세요
        </h3>
        <p className="share-modal__body">
          {copied
            ? '링크는 복사해뒀어요. 붙여넣기만 하면 친구가 탭해서 들어올 수 있어요.'
            : '아래 링크를 복사해서 붙여야 친구가 탭해서 들어올 수 있어요.'}
        </p>
        <ol className="share-modal__steps">
          <li>다음 화면에서 인스타그램 스토리를 고르세요</li>
          <li>편집 화면에서 스티커 → 🔗 링크 를 누르세요</li>
          <li>붙여넣기 하면 끝이에요</li>
        </ol>

        <div className="share-modal__url">
          <span className="share-modal__url-text">{url}</span>
          <button
            type="button"
            className="share-modal__copy"
            onClick={handleCopy}
            aria-label="URL 복사"
          >
            {justCopied || copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
            <span>{justCopied || copied ? '복사됨' : '복사'}</span>
          </button>
        </div>

        <button type="button" className="share-modal__done" onClick={onConfirm}>
          스토리로 보내기
        </button>
        <button type="button" className="share-modal__later" onClick={onClose}>
          나중에 할게요
        </button>
      </div>
    </div>
  );
}
