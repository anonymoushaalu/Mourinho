import type { ReactNode } from 'react';

/** Screen-reader-only text — e.g. context for an icon-only button that already has aria-label. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
