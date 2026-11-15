// Catches a screen that fails to load or to draw, so the app never goes blank.
// The usual cause is a lazy screen's file that can't be fetched: the device is
// offline, or the app was updated and an old tab asks for a file that's gone.
// Reloading fetches the current app.

import { TriangleAlert } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { strings } from '@/app/strings';
import { Button, Card } from './ui';

interface Props {
  /** When this changes (the route), a failed screen gets another try. */
  resetKey: string;
  children: ReactNode;
}

export class ScreenBoundary extends Component<Props, { failed: boolean; key: string }> {
  override state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: { failed: boolean; key: string }) {
    // Moving to another screen clears the error, so one bad screen doesn't block the rest.
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const t = strings.errors.screen;
    return (
      <Card role="alert" className="flex max-w-[560px] flex-col gap-3">
        <TriangleAlert size={24} strokeWidth={1.5} aria-hidden />
        <h1 className="type-title">{t.title}</h1>
        <p className="max-w-[68ch] type-body">{t.body}</p>
        <div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t.action}
          </Button>
        </div>
      </Card>
    );
  }
}
