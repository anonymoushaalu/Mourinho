import { NavigationActionButton } from '@/components/navigation/NavigationActionButton';
import type { NavigationAction } from '@/types';

export function NavigationActionList({ actions }: { actions: NavigationAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((action) => (
        <NavigationActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}
