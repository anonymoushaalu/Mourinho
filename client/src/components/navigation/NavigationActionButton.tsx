import { ArrowRight, ExternalLink, MoveDown, type LucideIcon } from 'lucide-react';

import type { NavigationAction } from '@/types';

const DEFAULT_ICON: Record<NavigationAction['kind'], LucideIcon> = {
  'internal-route': ArrowRight,
  'external-link': ExternalLink,
  'scroll-to-section': MoveDown,
};

function activate(action: NavigationAction): void {
  switch (action.kind) {
    case 'external-link':
      window.open(action.target, '_blank', 'noopener,noreferrer');
      return;
    case 'scroll-to-section':
      document.getElementById(action.target)?.scrollIntoView({ behavior: 'smooth' });
      return;
    case 'internal-route':
      // No router wired up yet — real navigation lands with the routing/backend phase.
      console.info(`[Gaffer] would navigate to ${action.target}`);
      return;
  }
}

export function NavigationActionButton({ action }: { action: NavigationAction }) {
  const Icon = action.icon ?? DEFAULT_ICON[action.kind];
  return (
    <button
      type="button"
      onClick={() => activate(action)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {action.label}
    </button>
  );
}
