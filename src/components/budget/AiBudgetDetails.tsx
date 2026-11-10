import React from 'react';
import { formatBRL } from '@/lib/format';

function Details({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return <div className="space-y-3">{value.map((entry, index) => <div key={index} className="border-b border-border pb-2"><Details value={entry} /></div>)}</div>;
  if (typeof value === 'object') return <dl className="space-y-2">{Object.entries(value).map(([key, entry]) => <div key={key} className="grid gap-1 sm:grid-cols-[minmax(120px,1fr)_2fr]"><dt className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</dt><dd className="min-w-0 break-words"><Details value={entry} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

export default function AiBudgetDetails({ snapshot }: { snapshot: any }) {
  return <section className="space-y-3 border-t border-border pt-4 text-sm">
    <h4 className="font-semibold">Orçamento IA — informações salvas</h4>
    {snapshot.costs?.venda !== undefined && <p className="font-semibold text-gold">Valor original: {formatBRL(snapshot.costs.venda)}</p>}
    <details><summary className="cursor-pointer py-2 font-medium">Parâmetros e especificações</summary><Details value={snapshot.inputs} /></details>
    <details><summary className="cursor-pointer py-2 font-medium">Análise completa, materiais e ferragens</summary><Details value={snapshot.result || snapshot} /></details>
    <details><summary className="cursor-pointer py-2 font-medium">Composição de custos original</summary><Details value={snapshot.costs} /></details>
  </section>;
}