/**
 * S3 / S3' — 결과 페이지 (v3: 토스 카드 위계 + BottomCTA).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronLeft, RotateCcw, ArrowRight, Camera, MessageCircle, Link as LinkIcon } from 'lucide-react';

import CaptureCard from '../components/CaptureCard';
import TypeCard from '../components/TypeCard';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import ShareActionButton from '../components/ShareActionButton';
import ActtubCTA from '../components/ActtubCTA';
import StoryShareGuideModal from '../components/StoryShareGuideModal';
import StoryCaptureCanvas from '../components/StoryCaptureCanvas';
import BottomCTA from '../components/BottomCTA';
import Toast from '../components/Toast';

import { isTypeCode } from '../content/schema';
import { getType } from '../content/types';
import { getMyTypeCode, clearMyTypeCode } from '../lib/storage';
import {
  buildShareUrl,
  canShareImageFile,
  copyResultUrl,
  getSiteUrl,
  renderCaptureBlob,
  saveCaptureAsImage,
  shareBlobToInstagram,
} from '../lib/share';
import { ensureKakaoReady, shareToKakao, isKakaoConfigured } from '../lib/kakao';
import { trackResultAction } from '../lib/analytics';
import { openActtub } from '../lib/acttub';

import NotFoundPage from './NotFoundPage';
import './ResultPage.css';

/** 캡처 대기가 영영 안 끝나면 버튼이 로딩 상태로 죽는다 — 상한을 둔다. */
const CAPTURE_IMAGE_TIMEOUT_MS = 5000;

async function waitForCaptureImages(node: HTMLElement): Promise<void> {
  const images = node.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map((img) =>
      // 이미 끝난 이미지는 성공이든 실패든(`complete && naturalWidth === 0`) 기다리지 않는다.
      // naturalWidth 까지 보면 실패한 이미지가 이미 지나간 load/error 를 기다리다 영영 안 풀린다.
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => {
              window.clearTimeout(timeoutId);
              resolve();
            };
            const timeoutId = window.setTimeout(done, CAPTURE_IMAGE_TIMEOUT_MS);
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
    )
  );
}

export default function ResultPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const myCode = useMemo(() => getMyTypeCode(), []);
  const storyRef = useRef<HTMLElement>(null);
  const storyCapturePromiseRef = useRef<Promise<Blob> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [storyLinkCopied, setStoryLinkCopied] = useState(false);
  const [canShareStory, setCanShareStory] = useState(true);

  useEffect(() => {
    const canShare = canShareImageFile();
    const timeoutId = window.setTimeout(() => setCanShareStory(canShare), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

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
  const storyShareUrl = buildShareUrl(type.code, 'story', siteUrl);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleRetry = () => {
    clearMyTypeCode();
    navigate('/quiz', { replace: true });
  };

  const filename = `acti-${type.code}.png`;
  const shareText = `${type.code} ${type.name} — ${storyShareUrl}`;

  const handleInstagramSave = async () => {
    if (!storyRef.current) return;
    // 캐릭터 PNG가 로드되기 전에 캡처하면 흰 화면이 나옴 — 명시적으로 기다림
    await waitForCaptureImages(storyRef.current);
    await saveCaptureAsImage(storyRef.current, filename);
    trackResultAction('save_image', type.code);
    // 이 경로는 공유시트가 없는 환경(주로 데스크탑)에서만 온다. 왜 저장만 되는지
    // 안 알려주면 "공유가 안 된다"로 읽힌다 — 실제로 그렇게 헷갈렸다.
    showToast('이미지를 저장했어요 — 스토리 공유는 폰에서 돼요');
  };

  const handleStoryGuideOpen = () => {
    // 제스처가 살아 있는 지금 복사해야 iOS Safari 가 허용한다 — 앞에 await 를 두지 않는다.
    // 인앱 브라우저엔 clipboard 가 없을 수 있고, 여기서 터지면 공유 자체가 막힌다.
    // 복사가 실패해도 흐름은 계속 — 모달이 "복사 안 됨" 상태로 직접 복사를 안내한다.
    setStoryLinkCopied(false);
    try {
      void navigator.clipboard
        ?.writeText(storyShareUrl)
        ?.then(() => setStoryLinkCopied(true))
        ?.catch(() => {});
    } catch {
      // clipboard 미지원
    }

    const node = storyRef.current;
    if (!node) return;

    const capturePromise = waitForCaptureImages(node).then(() =>
      renderCaptureBlob(node)
    );
    void capturePromise.catch(() => {});
    storyCapturePromiseRef.current = capturePromise;
    setShareModalOpen(true);
  };

  const handleStoryShareConfirm = async () => {
    const capturePromise = storyCapturePromiseRef.current;
    const node = storyRef.current;
    if (!capturePromise || !node) return;

    setShareModalOpen(false);
    try {
      const blob = await capturePromise;
      const result = await shareBlobToInstagram(blob, filename, shareText);
      if (result === 'shared') {
        trackResultAction('instagram_story', type.code);
      }
    } catch (error) {
      console.error('Story share failed', error);
      try {
        await saveCaptureAsImage(node, filename);
        trackResultAction('save_image', type.code);
        showToast('공유가 안 돼서 이미지로 저장했어요');
      } catch (saveError) {
        // 저장까지 실패했는데 "저장했어요"라고 하면 거짓말이 된다.
        console.error('Story image fallback failed', saveError);
        showToast('공유가 안 됐어요. 잠시 뒤 다시 해주세요');
      }
    } finally {
      storyCapturePromiseRef.current = null;
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
                label={canShareStory ? '스토리' : '이미지 저장'}
                onAction={canShareStory ? handleStoryGuideOpen : handleInstagramSave}
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
        <StoryShareGuideModal
          url={storyShareUrl}
          copied={storyLinkCopied}
          onConfirm={handleStoryShareConfirm}
          onClose={() => {
            storyCapturePromiseRef.current = null;
            setShareModalOpen(false);
          }}
        />
      )}

      {!isRecipient && <StoryCaptureCanvas ref={storyRef} type={type} />}
    </main>
  );
}
