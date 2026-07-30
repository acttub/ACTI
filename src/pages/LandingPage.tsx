/**
 * S1 — 랜딩 (v3: 토스 미니멀 톤 + BottomCTA + 모바일 풀폭).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock4 } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import BottomCTA from '../components/BottomCTA';
import CharacterAvatar from '../components/CharacterAvatar';
import { getAllTypes } from '../content/types';
import { trackEvent } from '../lib/acttub';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const all = getAllTypes();
  const hero = all[0]; // MINB

  useEffect(() => {
    trackEvent('landing_view');
  }, []);

  return (
    <main className="page page-enter page-landing">
      <div className="page-landing__top">
        <p className="page-landing__brand">연기스타일 찾기</p>
      </div>

      <section className="page-landing__hero">
        <div className="page-landing__hero-avatar avatar--idle">
          <CharacterAvatar
            typeIndex={hero.index}
            accessory={hero.accessory}
            face={hero.face}
            size="xl"
            label={`${hero.code} 캐릭터`}
          />
        </div>

        <h1 className="page-landing__title">
          연기 스타일을<br />
          찾아봐요!
        </h1>
        <p className="page-landing__sub">
          질문 14개로 찾아보는<br />
          내 연기 캐릭터.
        </p>

        <div className="page-landing__meta">
          <Clock4 size={14} aria-hidden="true" />
          <span>약 2~3분 · 14문항</span>
        </div>
      </section>

      <section className="page-landing__gallery">
        <h2 className="page-landing__gallery-title">16가지 캐릭터</h2>
        <p className="page-landing__gallery-sub">너는 어디에 가까울까?</p>
        <div className="page-landing__grid">
          {all.map((t) => (
            <div key={t.code} className="page-landing__cell" title={t.name}>
              <CharacterAvatar
                typeIndex={t.index}
                accessory={t.accessory}
                face={t.face}
                size="sm"
              />
              <span className="page-landing__cell-code">{t.code}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="page-landing__bottom-pad" aria-hidden="true" />

      <BottomCTA>
        <PrimaryButton size="xl" fullWidth onClick={() => navigate('/quiz')}>
          시작하기
          <ArrowRight size={20} aria-hidden="true" />
        </PrimaryButton>
      </BottomCTA>
    </main>
  );
}
