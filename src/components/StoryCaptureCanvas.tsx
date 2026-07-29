/**
 * StoryCaptureCanvas — 인스타 스토리(9:16) 전용 캡처 캔버스.
 *
 * 화면엔 안 보이는 540x960 오프스크린 DOM. 공유 시 html-to-image로
 * 이 노드를 PNG로 변환 → pixelRatio 2 적용해 최종 1080x1920 출력.
 * Story 비율에 맞춰 잘림/여백 없이 깔끔하게 올라가도록.
 */

import { forwardRef } from 'react';
import type { TypeContent } from '../content/schema';
import './StoryCaptureCanvas.css';

type Props = {
  type: TypeContent;
};

const StoryCaptureCanvas = forwardRef<HTMLElement, Props>(function StoryCaptureCanvas(
  { type },
  ref
) {
  return (
    <div className="story-canvas-wrapper" aria-hidden="true">
    <section
      ref={ref}
      className="story-canvas"
      data-type={String(type.index).padStart(2, '0')}
    >
      <header className="story-canvas__header">
        <span className="story-canvas__brand">acttub.com</span>
        <span className="story-canvas__dot">·</span>
        <span className="story-canvas__tag">연기 스타일 MBTI</span>
      </header>

      <div className="story-canvas__hero">
        <img
          src={`${import.meta.env.BASE_URL}characters/${type.code}.png`}
          alt=""
          className="story-canvas__avatar"
        />
        <div className="story-canvas__badge">{type.code}</div>
      </div>

      <div className="story-canvas__body">
        <h1 className="story-canvas__name">{type.name}</h1>
        <p className="story-canvas__tagline">"{type.tagline}"</p>
        <ul className="story-canvas__traits">
          {type.traits.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <footer className="story-canvas__footer">
        {/* 이 카드를 보고 오는 사람이 하려는 건 이 퀴즈다. 코어(acttub.com)를 적으면
            도착지가 어긋나고, "진단"은 제품 가드레일이 막은 판정 프레임이라 쓰지 않는다. */}
        {/* 인스타 링크 스티커를 닮은 알약. 웹에서는 스토리에 링크가 자동으로 안 붙어서
            사용자가 편집 화면에서 직접 스티커를 붙여야 하는데, 붙일 자리를 눈으로
            알려주는 역할을 한다. 안 붙여도 주소는 읽힌다. */}
        <div className="story-canvas__cta-sticker">
          <svg
            className="story-canvas__cta-ico"
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          acti.acttub.com
        </div>
        <div className="story-canvas__cta-sub">1분이면 나오는 내 유형</div>
      </footer>
    </section>
    </div>
  );
});

export default StoryCaptureCanvas;
