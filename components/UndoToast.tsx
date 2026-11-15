// A short message with an Undo button, shown for 10 seconds after a move
// (FR-6.13). The time stops while the pointer is over it or focus is inside it,
// so nobody is rushed (WCAG 2.2.1). Escape closes it.

import { RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from './ui';

const SHOWN_MS = 10_000;

export function UndoToast({
  message,
  undoLabel,
  dismissLabel,
  onUndo,
  onClose,
}: {
  message: string;
  undoLabel: string;
  dismissLabel: string;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const left = useRef(SHOWN_MS);
  const box = useRef<HTMLDivElement>(null);

  // Count down only while not paused, and keep what's left across pauses.
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [paused, onClose]);

  return (
    <div
      ref={box}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(box.current?.contains(document.activeElement) ?? false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!box.current?.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="fixed inset-x-gutter bottom-[calc(64px+var(--gutter))] z-40 mx-auto flex max-w-[480px] items-center gap-3 rounded-card border border-hairline bg-sheet py-2 pr-2 pl-5 text-foreground elev-overlay lg:bottom-gutter"
    >
      <p className="min-w-0 flex-1 type-body">{message}</p>
      <Button icon={RotateCcw} onClick={onUndo}>
        {undoLabel}
      </Button>
      <IconButton icon={X} label={dismissLabel} onClick={onClose} className="size-9" />
    </div>
  );
}
