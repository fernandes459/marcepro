import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, Printer, X } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatBRL } from '@/lib/format';
import type { ReportData } from '@/engines/ReportEngine';

export interface PresentationText {
  headline: string;
  summary: string;
  score: number;
  health_label: string;
  highlights: { title: string; text: string }[];
  risks: { title: string; text: string }[];
  actions: { title: string; text: string }[];
  closing: string;
}

const PIE = ['hsl(38 72% 52%)', 'hsl(200 18% 46%)', 'hsl(152 45% 42%)', 'hsl(0 60% 55%)', 'hsl(260 25% 55%)', 'hsl(30 30% 60%)'];

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <div className="slide-content bg-sidebar text-sidebar-foreground flex flex-col px-[110px] py-[90px]" style={{ width: 1920, height: 1080 }}>
      {children}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-primary uppercase font-semibold" style={{ fontSize: 24, letterSpacing: '0.14em' }}>{children}</p>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display font-bold text-sidebar-primary-foreground mt-4" style={{ fontSize: 76, lineHeight: 1.05 }}>{children}</h2>;
}

function ListSlide({ kicker, title, items, tone }: { kicker: string; title: string; items: { title: string; text: string }[]; tone: string }) {
  return (
    <Slide>
      <Kicker>{kicker}</Kicker>
      <Title>{title}</Title>
      <div className="grid grid-cols-3 gap-10 mt-20 flex-1">
        {items.slice(0, 3).map((it, i) => (
          <div key={i} className="rounded-3xl border border-sidebar-border bg-sidebar-accent/50 p-12" style={{ borderTop: `8px solid ${tone}` }}>
            <p className="font-display font-bold text-sidebar-primary-foreground" style={{ fontSize: 40, lineHeight: 1.15 }}>{it.title}</p>
            <p className="mt-6 text-sidebar-foreground/80" style={{ fontSize: 30, lineHeight: 1.35 }}>{it.text}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

export function buildSlides(r: ReportData, p: PresentationText, company: string) {
  const s = r.summary;
  const kpis = [
    { label: 'Entradas recebidas', value: s.income, color: 'hsl(152 45% 50%)' },
    { label: 'Saídas pagas', value: s.expense, color: 'hsl(0 60% 60%)' },
    { label: 'Resultado', value: s.profit, color: 'hsl(38 72% 55%)' },
  ];
  const axisStyle = { fontSize: 22, fill: 'hsl(40 10% 75%)' };
  return [
    <Slide key="cover">
      <div className="flex-1 flex flex-col justify-center">
        <Kicker>{company} · Relatório {r.kind === 'year' ? 'anual' : 'mensal'}</Kicker>
        <h1 className="font-display font-bold text-sidebar-primary-foreground mt-8" style={{ fontSize: 112, lineHeight: 1 }}>{p.headline}</h1>
        <p className="mt-10 text-sidebar-foreground/80 max-w-[1300px]" style={{ fontSize: 38, lineHeight: 1.3 }}>{p.summary}</p>
      </div>
      <div className="flex justify-between items-end">
        <p className="capitalize text-primary font-semibold" style={{ fontSize: 36 }}>{r.label}</p>
        <div className="text-right">
          <p className="text-sidebar-foreground/60" style={{ fontSize: 22 }}>Saúde financeira</p>
          <p className="font-display font-bold text-sidebar-primary-foreground" style={{ fontSize: 64 }}>{Math.round(p.score)}<span style={{ fontSize: 30 }}>/100 · {p.health_label}</span></p>
        </div>
      </div>
    </Slide>,
    <Slide key="kpis">
      <Kicker>Números do período</Kicker>
      <Title>O que entrou, saiu e sobrou</Title>
      <div className="grid grid-cols-3 gap-10 mt-16">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl bg-sidebar-accent/60 p-12 border border-sidebar-border">
            <p className="text-sidebar-foreground/70" style={{ fontSize: 28 }}>{k.label}</p>
            <p className="font-display font-bold mt-4 tabular-nums" style={{ fontSize: 64, color: k.color }}>{formatBRL(k.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-10 mt-10">
        {[
          { label: 'Margem', value: `${s.margin.toFixed(1)}%` },
          { label: 'A receber', value: formatBRL(s.receivable) },
          { label: 'A pagar', value: formatBRL(s.payable) },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl border border-sidebar-border p-10">
            <p className="text-sidebar-foreground/70" style={{ fontSize: 26 }}>{k.label}</p>
            <p className="font-display font-bold mt-3 text-sidebar-primary-foreground tabular-nums" style={{ fontSize: 48 }}>{k.value}</p>
          </div>
        ))}
      </div>
    </Slide>,
    <Slide key="trend">
      <Kicker>Evolução</Kicker>
      <Title>{r.kind === 'year' ? 'Mês a mês no ano' : 'Últimos 6 meses'}</Title>
      <div className="flex-1 mt-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.months} margin={{ left: 60, right: 20, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 10% 35%)" />
            <XAxis dataKey="label" tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Legend wrapperStyle={{ fontSize: 24 }} />
            <Bar dataKey="income" name="Entradas" fill="hsl(152 45% 45%)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name="Saídas" fill="hsl(0 60% 55%)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="result" name="Resultado" fill="hsl(38 72% 52%)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Slide>,
    <Slide key="exp">
      <Kicker>Para onde foi o dinheiro</Kicker>
      <Title>Despesas por categoria</Title>
      {r.expenseCategories.length === 0 ? (
        <p className="mt-20 text-sidebar-foreground/70" style={{ fontSize: 34 }}>Nenhuma despesa paga no período.</p>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-16 mt-10 items-center">
          <div className="h-[680px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={r.expenseCategories.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={170} outerRadius={300} isAnimationActive={false}>
                  {r.expenseCategories.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-6">
            {r.expenseCategories.slice(0, 6).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between gap-6 border-b border-sidebar-border pb-4">
                <span className="flex items-center gap-4 text-sidebar-primary-foreground" style={{ fontSize: 32 }}>
                  <span className="inline-block rounded-full" style={{ width: 22, height: 22, background: PIE[i % PIE.length] }} />{c.name}
                </span>
                <span className="tabular-nums font-semibold" style={{ fontSize: 32 }}>{formatBRL(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Slide>,
    <ListSlide key="hl" kicker="Destaques" title="O que foi bem" items={p.highlights} tone="hsl(152 45% 45%)" />,
    <ListSlide key="risk" kicker="Pontos de atenção" title="Riscos do período" items={p.risks.length ? p.risks : [{ title: 'Sem riscos relevantes', text: 'Nenhum ponto crítico identificado nos números.' }]} tone="hsl(0 60% 55%)" />,
    <ListSlide key="act" kicker="Próximos passos" title="Plano de ação" items={p.actions} tone="hsl(38 72% 52%)" />,
    <Slide key="end">
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <Kicker>{company}</Kicker>
        <p className="font-display font-bold text-sidebar-primary-foreground mt-10 max-w-[1400px]" style={{ fontSize: 72, lineHeight: 1.15 }}>{p.closing}</p>
        <p className="mt-12 text-sidebar-foreground/60 capitalize" style={{ fontSize: 28 }}>{r.label} · análise gerada por IA com os dados do sistema</p>
      </div>
    </Slide>,
  ];
}

function Scaled({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div className="absolute" style={{ width: 1920, height: 1080, left: '50%', top: '50%', marginLeft: -960, marginTop: -540, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

export default function AIPresentation({ report, text, company, onClose }: { report: ReportData; text: PresentationText; company: string; onClose: () => void }) {
  const slides = buildSlides(report, text, company);
  const [i, setI] = useState(0);
  const [printing, setPrinting] = useState(false);
  const touchX = useRef<number | null>(null);
  const next = useCallback(() => setI((v) => Math.min(slides.length - 1, v + 1)), [slides.length]);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const print = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 400);
  };

  if (printing) {
    return createPortal(
      <div className="ai-print-root">
        <style>{`@page { size: 1920px 1080px; margin: 0 } body > *:not(.ai-print-root){display:none!important} .ai-print-page{break-after:page;page-break-after:always} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
        {slides.map((s, k) => <div key={k} className="ai-print-page">{s}</div>)}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touchX.current = null;
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <p className="font-display font-semibold text-sm truncate flex-1">Apresentação · <span className="capitalize">{report.label}</span></p>
        <span className="text-xs text-muted-foreground tabular-nums">{i + 1}/{slides.length}</span>
        <button className="rounded-md p-2 hover:bg-muted" title="Tela cheia" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 className="h-4 w-4" /></button>
        <button className="rounded-md p-2 hover:bg-muted" title="Imprimir / Salvar PDF" onClick={print}><Printer className="h-4 w-4" /></button>
        <button className="rounded-md p-2 hover:bg-muted" title="Fechar" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 relative bg-foreground/90">
        <Scaled>{slides[i]}</Scaled>
        <button onClick={prev} disabled={i === 0} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-3 shadow disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={next} disabled={i === slides.length - 1} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-3 shadow disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="flex justify-center gap-1.5 py-2">
        {slides.map((_, k) => (
          <button key={k} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'}`} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
