import { useEffect, useState } from 'react';

export type NavSide = 'left' | 'right';

/** Preferência de lado (esquerda/direita) de um menu, salva no navegador. */
export function useNavSide(key: 'app' | 'finance'): [NavSide, (s: NavSide) => void] {
  const storageKey = `marcepro-nav-side-${key}`;
  const [side, setSide] = useState<NavSide>(() =>
    (typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'right') ? 'right' : 'left',
  );
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.key === storageKey) setSide(d.side);
    };
    window.addEventListener('marcepro-nav-side', onChange);
    return () => window.removeEventListener('marcepro-nav-side', onChange);
  }, [storageKey]);
  const update = (s: NavSide) => {
    localStorage.setItem(storageKey, s);
    setSide(s);
    window.dispatchEvent(new CustomEvent('marcepro-nav-side', { detail: { key: storageKey, side: s } }));
  };
  return [side, update];
}
