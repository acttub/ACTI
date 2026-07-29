/**
 * CaptureCard — 캡처 영역 (v3: 토스 카드 톤 + 큰 캐릭터 헤로).
 */

import { forwardRef } from 'react';
import Badge from './Badge';
import CharacterAvatar from './CharacterAvatar';
import type { FaceVariant, TypeIndex } from '../content/schema';
import './CaptureCard.css';

type Props = {
  typeIndex: TypeIndex;
  code: string;
  name: string;
  tagline: string;
  traits: string[];
  accessory: string;
  face?: FaceVariant;
  celebrate?: boolean;
};

const CaptureCard = forwardRef<HTMLElement, Props>(function CaptureCard(
  { typeIndex, code, name, tagline, traits, accessory, face, celebrate = false },
  ref
) {
  return (
    <section
      ref={ref}
      className={`capture ${celebrate ? 'capture--celebrate' : ''}`}
      data-type={String(typeIndex).padStart(2, '0')}
      aria-label="결과 카드"
    >
      <div className="capture__hero">
        <CharacterAvatar
          typeIndex={typeIndex}
          accessory={accessory}
          face={face}
          size="xl"
          label={`${code} 캐릭터`}
        />
        <Badge code={code} size="lg" />
      </div>
      <div className="capture__body">
        <h1 className="capture__name">{name}</h1>
        <div className="capture__bubble">
          <p className="capture__tagline">"{tagline}"</p>
        </div>
        <ul className="capture__traits">
          {traits.map((t, i) => (
            <li key={i} className="capture__trait">
              <span className="capture__trait-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="capture__trait-text">{t}</span>
            </li>
          ))}
        </ul>
        <div className="capture__watermark">
          <span className="capture__watermark-url">acti.acttub.com</span>
          <span className="capture__watermark-sub">연기 스타일 MBTI</span>
        </div>
      </div>
    </section>
  );
});

export default CaptureCard;
