import { APP_NAME } from '@mourinho/shared';

import { ErrorBoundary } from '@/app/ErrorBoundary';
import { GafferWidget } from '@/components/GafferWidget';

/**
 * Application shell. Providers (router, query client, theme) mount here as
 * they are introduced, so feature code never has to know about global wiring.
 */
export function App() {
  return (
    <ErrorBoundary>
      <main>
        <h1>{APP_NAME}</h1>
      </main>
      <GafferWidget />
    </ErrorBoundary>
  );
}
