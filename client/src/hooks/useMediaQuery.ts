import { useSyncExternalStore } from 'react';

function subscribe(query: string, onChange: () => void) {
  const mediaQueryList = window.matchMedia(query);
  mediaQueryList.addEventListener('change', onChange);
  return () => mediaQueryList.removeEventListener('change', onChange);
}

/**
 * Reserved for the one thing Tailwind breakpoints can't express in JS terms —
 * e.g. telling a future R3F canvas which pixel-ratio/resolution tier to
 * render at. Layout itself should stay declarative `sm:`/`md:` classes.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
