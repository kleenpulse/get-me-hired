// Form fields from DESIGN.md: a 46px pill input with its label always above
// it, a caption for help, and lists of items shown as chips (FR-3.4).

import { Plus, X } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { addItems, splitItems } from '@/core/profile';
import { strings } from '@/app/strings';
import { cx } from './ui';

const c = strings.profile.chips;

export const INPUT =
  'min-h-[46px] w-full min-w-0 rounded-pill bg-lift px-4 text-foreground placeholder:text-ink-3 type-body aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-critical';

/**
 * The label line: the label, and "Required" beside it when it is. Without
 * `htmlFor` it names a group of fields (through `id`), so it isn't a `<label>`.
 */
export function FieldLabel({ htmlFor, id, required, children }: { htmlFor?: string; id?: string; required?: boolean; children: ReactNode }) {
  const Tag = htmlFor ? 'label' : 'span';
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <Tag htmlFor={htmlFor} id={id} className="type-label">
        {children}
      </Tag>
      {required && <span className="text-ink-2 type-caption">{strings.profile.required}</span>}
    </span>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  help?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, help, error, required, value, onChange, className, ...props }: TextFieldProps) {
  const id = useId();
  const described = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={INPUT}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-critical type-caption">
          {error}
        </p>
      )}
      {help && (
        <p id={`${id}-help`} className="max-w-[68ch] text-ink-2 type-caption">
          {help}
        </p>
      )}
    </div>
  );
}

interface ChipFieldProps {
  label: string;
  help: string;
  required?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
  /** Tap to add (FR-3.4). Ideas already in the list are hidden. */
  examples?: readonly string[];
}

/**
 * A list of short items. Type one and press Enter, or type a comma between
 * items. Each chip has its own remove button, so it works by keyboard.
 */
export function ChipField({ label, help, required, values, onChange, examples = [] }: ChipFieldProps) {
  const id = useId();
  const [text, setText] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const has = (item: string) => values.some((value) => value.toLowerCase() === item.toLowerCase());
  const ideas = examples.filter((example) => !has(example));

  const add = (raw: string) => {
    const items = splitItems(raw).filter((item) => !has(item));
    if (items.length === 0) return;
    onChange(addItems(values, items));
    setAnnouncement(items.map(c.added).join(' '));
  };

  const remove = (item: string) => {
    onChange(values.filter((value) => value !== item));
    setAnnouncement(c.removed(item));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>

      {values.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value} className="inline-flex min-h-9 items-center gap-1 rounded-pill bg-nested py-1 pr-1 pl-3.5 type-label">
              {value}
              <button
                type="button"
                aria-label={c.remove(value)}
                title={c.remove(value)}
                onClick={() => remove(value)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-pill hover:bg-glass"
              >
                <X size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        value={text}
        aria-required={required || undefined}
        aria-describedby={`${id}-help`}
        enterKeyHint="done"
        onChange={(event) => {
          // A comma ends an item, so pasting "React, Vue" adds both.
          const parts = event.target.value.split(',');
          if (parts.length > 1) {
            add(parts.slice(0, -1).join(','));
            setText(parts.at(-1) ?? '');
          } else {
            setText(event.target.value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          add(text);
          setText('');
        }}
        onBlur={() => {
          add(text);
          setText('');
        }}
        className={INPUT}
      />
      <p id={`${id}-help`} className="max-w-[68ch] text-ink-2 type-caption">
        {help}
      </p>

      {ideas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-2 type-caption">{c.examples}</span>
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              aria-label={c.add(idea)}
              onClick={() => add(idea)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-pill bg-lift px-3 type-caption transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
            >
              <Plus size={14} strokeWidth={1.5} aria-hidden />
              {idea}
            </button>
          ))}
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
