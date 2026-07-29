/**
 * ChoiceCard — 시나리오 4지선다 (v3: 토스 ListRow 톤).
 */

import { Check, type LucideIcon } from 'lucide-react';
import './ChoiceCard.css';

type Props = {
  icon: LucideIcon;
  label: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export default function ChoiceCard({
  icon: Icon,
  label,
  selected = false,
  onClick,
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      className={`choice ${selected ? 'choice--selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      {/* 선택 표시를 오른쪽에 따로 두면 그 40px 만큼 라벨이 좁아져 줄 수가 늘고,
          선택지 묶음이 행 높이를 맞추는 그리드라 4개 버튼이 한꺼번에 커진다
          (실측: 85px → 110px, 마지막 버튼이 99px 아래로 밀림). 왼쪽 아이콘을
          체크로 바꾸면 폭이 변하지 않아 어느 상태에서도 위치가 그대로다. */}
      <span className="choice__icon-wrap" aria-hidden="true">
        {selected ? (
          <Check size={22} strokeWidth={3} className="choice__check-mark" />
        ) : (
          <Icon size={22} strokeWidth={2.1} />
        )}
      </span>
      <span className="choice__label">{label}</span>
    </button>
  );
}
