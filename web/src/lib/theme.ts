/** Light / dark theme: follows the system until the visitor picks one; the choice is kept on this device. */
import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const KEY = 'niran.theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage blocked: follow the system */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const apply = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0B0D12' : '#FFFFFF');
};

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: initial(),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, theme); } catch { /* not kept, still applied */ }
    apply(theme);
    set({ theme });
  },
}));
apply(useTheme.getState().theme);
