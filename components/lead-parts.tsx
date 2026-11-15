// The small product pieces from DESIGN.md: the contact label, the tier chip
// and the freshness ring. Each one pairs its colour or shape with a word, so
// nothing depends on colour alone.

import { Check, CircleHelp, Shapes } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ContactLabel, Tier } from '@/core/lead';
import { strings } from '@/app/strings';
import { cx } from './ui';

const LABEL_STYLES: Record<ContactLabel, string> = {
  published: 'bg-ok-soft text-ok',
  pattern: 'bg-warn-soft text-warn',
  // Dashed and unfilled: nobody confirmed this address.
  guess: 'border border-dashed border-ink-3 text-ink-2',
};

const LABEL_ICONS = { published: Check, pattern: Shapes, guess: CircleHelp };

/** How sure we are about an address (FR-5.3). The word is always shown. */
export function ContactLabelPill({ label }: { label: ContactLabel }) {
  const Glyph = LABEL_ICONS[label];
  return (
    <span className={cx('inline-flex min-h-6 items-center gap-1 rounded-pill px-2.5 type-caption', LABEL_STYLES[label])}>
      <Glyph size={14} strokeWidth={1.5} aria-hidden />
      {strings.lead.labels[label]}
    </span>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  A: 'bg-primary text-primary-foreground',
  B: 'bg-nested text-foreground',
  C: 'border border-ink-3 text-ink-2',
};

/** The tier, on the system's own ladder with no hue (FRD §9.3). */
export function TierChip({ tier }: { tier: Tier }) {
  return (
    <span
      role="img"
      aria-label={strings.lead.tier(tier)}
      title={strings.lead.tier(tier)}
      className={cx('flex size-6 shrink-0 items-center justify-center rounded-pill type-caption', TIER_STYLES[tier])}
    >
      {tier}
    </span>
  );
}

const RING_SIZE = 54;
const RING_RADIUS = 25;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const RING_TONES = { signal: 'stroke-signal', ink: 'stroke-foreground', warn: 'stroke-warn' };

interface FreshnessChipProps {
  /** Shown in the chip. A company's first letter: the app never loads logos. */
  letter: string;
  /** How much of the lead's window is left, from 1 to 0. `null` when the age is unknown. */
  left: number | null;
  tone: keyof typeof RING_TONES;
}

/**
 * A lead's chip with a ring that drains as its window closes. The ring is
 * hidden from screen readers, because the age is always written beside it.
 */
export function FreshnessChip({ letter, left, tone }: FreshnessChipProps) {
  // Set from script as a custom property, which a strict style policy allows.
  const style = { '--ring-gap': `${RING_LENGTH * (1 - (left ?? 1))}` } as CSSProperties;
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        aria-hidden
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90"
        style={style}
      >
        {left === null ? (
          <circle cx="27" cy="27" r={RING_RADIUS} fill="none" strokeWidth="1" strokeDasharray="3 4" className="stroke-ink-3" />
        ) : (
          <circle
            cx="27"
            cy="27"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset="var(--ring-gap)"
            className={RING_TONES[tone]}
          />
        )}
      </svg>
      <span aria-hidden className="flex size-[46px] items-center justify-center rounded-pill bg-lift type-label">
        {letter}
      </span>
    </span>
  );
}
