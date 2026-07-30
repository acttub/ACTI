/**
 * S2 — 문항 페이지 (v3: 토스 톤 + 더 큰 본문 + 진행률 진한 막대).
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import ChoiceCard from '../components/ChoiceCard';
import { QUESTIONS } from '../content/questions';
import { computeType } from '../lib/scoring';
import { setMyTypeCode } from '../lib/storage';
import { resetResultViewTracking, trackEvent } from '../lib/acttub';
import type { Choice } from '../content/schema';
import './QuizPage.css';

export default function QuizPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Choice | null)[]>(
    () => QUESTIONS.map(() => null)
  );

  const question = QUESTIONS[index];
  const total = QUESTIONS.length;

  useEffect(() => {
    trackEvent('quiz_start');
  }, []);

  const handleSelect = (choice: Choice) => {
    const next = answers.slice();
    next[index] = choice;
    setAnswers(next);

    if (index < total - 1) {
      setTimeout(() => setIndex(index + 1), 240);
    } else {
      trackEvent('quiz_complete');
      setTimeout(() => {
        const filled = next.filter((c): c is Choice => c !== null);
        const code = computeType(filled);
        setMyTypeCode(code);
        resetResultViewTracking();
        navigate(`/result/${code}`, { replace: true });
      }, 320);
    }
  };

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  const currentSelected = answers[index];

  const choiceCards = useMemo(
    () =>
      question.choices.map((c, i) => {
        const isSelected = currentSelected?.label === c.label;
        return (
          <ChoiceCard
            key={`${question.id}-${i}`}
            icon={c.icon}
            label={c.label}
            selected={isSelected}
            onClick={() => handleSelect(c)}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id, currentSelected]
  );

  return (
    <main className="page page-enter page-quiz">
      <ProgressBar
        current={index + 1}
        total={total}
        onBack={index > 0 ? handleBack : undefined}
      />
      <div className="page-quiz__container">
        <section className="page-quiz__body" key={question.id}>
          <p className="page-quiz__scenario">{question.scenario}</p>
          <h2 className="page-quiz__question">{question.question}</h2>
          <div className="page-quiz__choices">{choiceCards}</div>
        </section>
      </div>
    </main>
  );
}
