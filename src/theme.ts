import {useCallback, useSyncExternalStore} from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'how-things-work-theme';

const stored = (): Theme | null => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

/** Dark is the house style, so it is what a viewer with no light preference gets. */
const preferred = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

// One value for the whole page. The gallery header, the studio rail and the 3D
// room all read it, so it cannot live inside any one component's state.
let current: Theme = typeof window === 'undefined' ? 'dark' : (stored() ?? preferred());
const listeners = new Set<() => void>();

function apply(theme: Theme) {
  if (theme === current) return;
  current = theme;
  document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    document.documentElement.dataset.theme = current;
  }
  listeners.add(listener);
  const query = typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: light)');
  // Until someone chooses, the page keeps following the system setting.
  const follow = () => {
    if (!stored()) apply(preferred());
  };
  query?.addEventListener('change', follow);
  return () => {
    listeners.delete(listener);
    query?.removeEventListener('change', follow);
  };
}

/** The chosen theme, remembered per browser and shared by every component. */
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'dark' as Theme,
  );
  const toggle = useCallback(() => {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // A browser with site data blocked still gets the switch, just not the memory of it.
    }
    apply(next);
  }, []);
  return [theme, toggle];
}
