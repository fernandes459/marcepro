import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface TourStep { target: string; title: string; text: string; onEnter?: () => void }

const KEY = 'marcepro-finance-tour-v1';

export function useFinanceTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!localStorage.getItem(KEY)) setTimeout(() => setOpen(true), 800); }, []);
  return { open, start: () => setOpen(true), close: () => { localStorage.setItem(KEY, '1'); setOpen(false); } };
}

export default function FinanceTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useEffect(() => { if (open) setI(0); }, [open]);
  useLayoutEffect(() => {
    if (!open || !step) return;
    step.onEnter?.();
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => setRect(el.getBoundingClientRect()), 350); }
      else setRect(null);
    }, 120);
    return () => clearTimeout(t);
  }, [open, i, step]);

  if (!open || !step) return null;
  const pad = 6;
  const below = rect ? rect.bottom + 180 < window.innerHeight : true;
  const boxTop = rect ? (below ? rect.bottom + 12 : Math.max(12, rect.top - 190)) : window.innerHeight / 2 - 90;
  const boxLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 332) : window.innerWidth / 2 - 160;

  return (
    <div className="fixed inset-0 z-[100]">
      {rect ? (
        <div className="absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px hsl(var(--foreground) / 0.55)' }} />
      ) : <div className="absolute inset-0 bg-foreground/55" />}
      <div className="absolute w-[320px] max-w-[calc(100vw-24px)] rounded-xl border bg-card p-4 shadow-xl" style={{ top: boxTop, left: boxLeft }}>
        <p className="text-xs text-muted-foreground">Passo {i + 1} de {steps.length}</p>
        <p className="font-semibold mt-1">{step.title}</p>
        <p className="text-sm text-muted-foreground mt-1">{step.text}</p>
        <div className="flex justify-between mt-4">
          <Button size="sm" variant="ghost" onClick={onClose}>Pular</Button>
          <div className="flex gap-2">
            {i > 0 && <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Voltar</Button>}
            <Button size="sm" onClick={() => (i === steps.length - 1 ? onClose() : setI(i + 1))}>{i === steps.length - 1 ? 'Concluir' : 'Próximo'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
