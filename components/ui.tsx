// The basic Dawn pieces from DESIGN.md: buttons, cards, pills and tags.
// Sizes are minimums, so they grow with the Text size setting.

import type { ButtonHTMLAttributes, ComponentType, HTMLAttributes, ReactNode } from 'react';

export type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;

/** Joins class names, skipping anything empty. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const PRESSABLE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill transition-[transform,background-color,opacity] duration-150 ease-dawn active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'min-h-[46px] bg-primary px-6 text-primary-foreground type-action',
  secondary: 'min-h-[46px] bg-nested px-5 text-foreground type-label hover:brightness-95',
  quiet: 'min-h-[36px] bg-transparent px-1 text-foreground type-label underline-offset-4 hover:underline',
  destructive: 'min-h-[46px] bg-critical px-5 text-critical-foreground type-label',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: Icon;
}

/** One primary button per view (DESIGN.md). Everything else is secondary or quiet. */
export function Button({ variant = 'secondary', icon: IconGlyph, className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cx(PRESSABLE, BUTTON_VARIANTS[variant], className)} {...props}>
      {IconGlyph && <IconGlyph size={16} strokeWidth={1.5} aria-hidden />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: Icon;
  /** Read by screen readers and shown as a tooltip. */
  label: string;
}

export function IconButton({ icon: IconGlyph, label, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(PRESSABLE, 'size-11 shrink-0 bg-nested text-foreground hover:brightness-95', className)}
      {...props}
    >
      <IconGlyph size={20} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

type CardTone = 'pearl' | 'slate' | 'dawn';

const CARD_TONES: Record<CardTone, string> = {
  pearl: 'bg-card',
  slate: 'bg-slate',
  dawn: 'bg-dawn',
};

interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  as?: 'section' | 'article' | 'div' | 'aside';
}

/** Cards are told apart by their fill. They have no border and no shadow. */
export function Card({ tone = 'pearl', as: Tag = 'section', className, ...props }: CardProps) {
  return <Tag className={cx('rounded-card p-card text-foreground', CARD_TONES[tone], className)} {...props} />;
}

/** A soft signal, such as "Pay unknown". */
export function Tag({ icon: IconGlyph, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-pill bg-nested px-3 text-foreground type-caption">
      {IconGlyph && <IconGlyph size={14} strokeWidth={1.5} aria-hidden />}
      {children}
    </span>
  );
}

/** Dashed means unverified, and nothing else is dashed (DESIGN.md). */
export function UnverifiedTag({ icon: IconGlyph, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-pill border border-dashed border-ink-3 px-3 text-ink-2 type-caption">
      {IconGlyph && <IconGlyph size={14} strokeWidth={1.5} aria-hidden />}
      {children}
    </span>
  );
}

/** A fact about a lead: a white chip, the value, and its name under it. */
export function StatPill({ icon: IconGlyph, value, name }: { icon: Icon; value: ReactNode; name: string }) {
  return (
    <div className="flex min-h-[50px] items-center gap-2.5 rounded-pill bg-nested py-1 pr-4 pl-[5px]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-lift">
        <IconGlyph size={20} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="type-label tabular">{value}</span>
        <span className="text-ink-2 type-caption">{name}</span>
      </span>
    </div>
  );
}

/** A white pill with an optional dot, such as "Hunted 08:12". */
export function StatusPill({ dot, pulsing, children }: { dot?: boolean; pulsing?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-pill bg-lift px-3.5 type-label">
      {dot && <span aria-hidden className={cx('size-2 rounded-pill bg-signal', pulsing && 'animate-fresh-dot')} />}
      {children}
    </span>
  );
}

type BannerTone = 'info' | 'warning' | 'failure';

const BANNER_TONES: Record<BannerTone, string> = {
  info: 'bg-nested',
  warning: 'bg-warn-soft',
  failure: 'bg-critical-soft',
};

export function Banner({
  tone = 'info',
  icon: IconGlyph,
  children,
  action,
}: {
  tone?: BannerTone;
  icon: Icon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3 rounded-tile px-4 py-3 text-foreground', BANNER_TONES[tone])}>
      <IconGlyph size={20} strokeWidth={1.5} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 basis-56 type-body">{children}</p>
      {action}
    </div>
  );
}

/** A centred message for a screen with nothing to show. It never shows invented leads. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center gap-3 px-4 py-12 text-center">
      <span aria-hidden className="flex items-center gap-1.5">
        <span className="size-8 rounded-pill bg-nested" />
        <span className="h-8 w-20 rounded-pill bg-nested" />
        <span className="size-8 rounded-pill border border-dashed border-ink-3" />
      </span>
      <h2 className="type-title">{title}</h2>
      {body && <p className="text-ink-2 type-body">{body}</p>}
      {action}
    </div>
  );
}
