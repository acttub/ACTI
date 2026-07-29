/**
 * S3 / S3' — 결과 페이지 (v3: 토스 카드 위계 + BottomCTA).
 */

import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, RotateCcw, ArrowRight, Camera, MessageCircle, Link as LinkIcon } from 'lucide-react';

import CaptureCard from '../components/CaptureCard';
import TypeCard from '../components/TypeCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import ShareActionButton from '../components/ShareActionButton';
import ActtubCTA from '../components/ActtubCTA';
import ShareSuccessModal from '../components/ShareSuccessModal';
import StoryCaptureCanvas from '../components/StoryCaptureCanvas';
import BottomCTA from '../components/BottomCTA';
import Toast from '../components/Toast';

import { isTypeCode } from '../content/schema';
import { getType } from '../content/types';
import { getMyTypeCode, clearMyTypeCode } from '../lib/storage';
import { getSiteUrl, shareCaptureToInstagram, copyResultUrl, canShareImageFile } from '../lib/share';
import { ensureKakaoReady, shareToKakao, isKakaoConfigured } from '../lib/kakao';
import { trackResultAction } from '../lib/analytics';
import { openActtub } from '../lib/acttub';

import NotFoundPage from './NotFoundPage';
import './ResultPage.css';

export default function ResultPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const myCode = useMemo(() => getMyTypeCode(), []);
  const storyRef = useRef<HTMLElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  if (!rawCode || !isTypeCode(rawCode)) {
    return <NotFoundPage />;
  }
  const code = rawCode;

  const isRecipient = !myCode || myCode !== code;
  const isCelebrate = !isRecipient && myCode === code;

  const type = getType(code);
  const rival = getType(type.rival);
  const bff = getType(type.bff);
  const siteUrl = getSiteUrl();

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleRetry = () => {
    clearMyTypeCode();
    navigate('/quiz', { replace: true });
  };

  const handleInstagramShare = async () => {
    if (!storyRef.current) return;
    if (!canShareImageFile()) {
      showToast('스토리 공유는 모바일에서만 가능해요');
      return;
    }
    // 캐릭터 PNG가 로드되기 전에 캡처하면 흰 화면이 나옴 — 명시적으로 기다림
    const images = storyRef.current.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
      )
    );

    const filename = `acti-${type.code}.png`;
    const shareText = `${type.code} ${type.name} — ${siteUrl}/result/${type.code}`;
    const result = await shareCaptureToInstagram(storyRef.current, filename, shareText);
    if (result === 'shared') {
      trackResultAction('instagram_story', type.code);
      setShareModalOpen(true);
    }
  };

  const handleKakaoShare = async () => {
    if (!ensureKakaoReady()) {
      showToast('카카오 공유 준비 중이에요');
      throw new Error('Kakao not ready');
    }
    shareToKakao(type, siteUrl);
    trackResultAction('kakao_share', type.code);
  };

  const handleCopyLink = async () => {
    await copyResultUrl(type.code);
    trackResultAction('copy_link', type.code);
    showToast('링크가 복사됐어요');
  };

  return (
    <main className="page page-enter page-result">
      <Helmet>
        <title>{code} {type.name} — ACTI</title>
        <meta name="description" content={type.tagline} />
        <meta property="og:title" content={`${code} ${type.name}`} />
        <meta property="og:description" content={type.tagline} />
        <meta property="og:image" content={`${siteUrl}/og/${code}.jpg`} />
        <meta property="og:url" content={`${siteUrl}/result/${code}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <header className="page-result__topbar">
        <Link to="/" aria-label="처음으로" className="page-result__back">
          <ChevronLeft size={24} aria-hidden="true" />
        </Link>
        <span className="page-result__topbar-title">ACTI</span>
        <span aria-hidden="true" style={{ width: 40 }} />
      </header>

      <div className="page-result__container">
        {isRecipient && (
          <div className="page-result__visitor">
            <span>친구가 풀어본 결과예요</span>
          </div>
        )}

        <CaptureCard
          typeIndex={type.index}
          code={type.code}
          name={type.name}
          tagline={type.tagline}
          traits={type.traits}
          accessory={type.accessory}
          face={type.face}
          celebrate={isCelebrate}
        />

        <section className="page-result__section">
          <h3 className="page-result__section-title">어울리는 역할</h3>
          <ul className="page-result__role-list">
            {type.roles.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>

        <section className="page-result__section">
          <h3 className="page-result__section-title">너의 관계</h3>
          <div className="page-result__relations">
            <TypeCard
              relation="rival"
              code={rival.code}
              name={rival.name}
              typeIndex={rival.index}
              accessory={rival.accessory}
              face={rival.face}
            />
            <TypeCard
              relation="bff"
              code={bff.code}
              name={bff.name}
              typeIndex={bff.index}
              accessory={bff.accessory}
              face={bff.face}
            />
          </div>
        </section>

        {!isRecipient && (
          <section className="page-result__share">
            <h3 className="page-result__share-title">친구한테 자랑하기</h3>
            <div className="share-group">
              <ShareActionButton
                type="instagram"
                icon={Camera}
                label="스토리"
                onAction={handleInstagramShare}
              />
              {isKakaoConfigured && (
                <ShareActionButton
                  type="kakao"
                  icon={MessageCircle}
                  label="카카오톡"
                  onAction={handleKakaoShare}
                />
              )}
              <ShareActionButton
                type="link"
                icon={LinkIcon}
                label="링크복사"
                onAction={handleCopyLink}
              />
            </div>
          </section>
        )}

        <ActtubCTA
          withButton={isRecipient}
          onGo={() => trackResultAction('acttub_cta', type.code)}
        />

        <SecondaryButton size="lg" fullWidth onClick={handleRetry}>
          <RotateCcw size={18} aria-hidden="true" /> 다시 풀어보기
        </SecondaryButton>

        <div className="page-result__bottom-pad" aria-hidden="true" />
      </div>

      {/* 방문자는 먼저 자기 유형을 뽑게 하고, 본인은 acttub 으로 넘긴다. */}
      <BottomCTA>
        {isRecipient ? (
          <PrimaryButton size="xl" fullWidth onClick={() => navigate('/quiz')}>
            나도 풀어보기
            <ArrowRight size={20} aria-hidden="true" />
          </PrimaryButton>
        ) : (
          <PrimaryButton
            size="xl"
            fullWidth
            onClick={() => openActtub(() => trackResultAction('acttub_cta', type.code))}
          >
            acttub 시작하기
            <ArrowRight size={20} aria-hidden="true" />
          </PrimaryButton>
        )}
      </BottomCTA>

      {toast && <Toast message={toast} />}

      {shareModalOpen && (
        <ShareSuccessModal
          url={`${siteUrl}/result/${type.code}`}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {!isRecipient && <StoryCaptureCanvas ref={storyRef} type={type} />}
    </main>
  );
}
