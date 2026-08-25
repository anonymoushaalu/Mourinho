import type { LucideIcon } from 'lucide-react';

/**
 * An AI-triggerable action surfaced under an assistant message, e.g.
 * "View my resume" or "Open the contact form". Nothing populates these yet —
 * real messages will carry them once the backend parses structured actions
 * out of model output — but the render path needs the shape now.
 */
export type NavigationActionKind = 'internal-route' | 'external-link' | 'scroll-to-section';

export interface NavigationAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  kind: NavigationActionKind;
  /** A route path, URL, or element id, depending on `kind`. */
  target: string;
}
