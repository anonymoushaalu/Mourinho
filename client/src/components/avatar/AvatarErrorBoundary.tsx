import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Scoped crash barrier around the 3D avatar only. A GLB load failure, a WebGL
 * initialization error, or any other render error inside `ThreeAvatarRenderer`
 * must degrade to `AvatarPlaceholder`, not propagate up to `app/ErrorBoundary`
 * and take down the whole chat widget over a decorative element.
 *
 * No retry/reset: if the GLB is broken it stays broken on retry, and retrying
 * would thrash WebGL context creation. Permanent graceful degradation is the
 * correct behavior here.
 */
export class AvatarErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The Gaffer 3D avatar failed to render; falling back to the placeholder.', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
