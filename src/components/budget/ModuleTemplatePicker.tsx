import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Layers, Search } from 'lucide-react';
import { TEMPLATE_CATEGORIES, type ModuleTemplate } from './moduleTemplates';
import type { ModuleConfig } from './ModuleConfigurator';
import { toast } from 'sonner';

interface Props {
  onApplyTemplate: (modules: ModuleConfig[], mode: 'replace' | 'append') => void;
  hasExistingModules: boolean;
}

export default function ModuleTemplatePicker({ onApplyTemplate, hasExistingModules }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ModuleTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(TEMPLATE_CATEGORIES[0].id);

  const totalModules = useMemo(
    () => TEMPLATE_CATEGORIES.reduce((s, c) => s + c.templates.length, 0),
    []
  );

  // Resultados de busca global
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const all: { cat: string; tpl: ModuleTemplate }[] = [];
    TEMPLATE_CATEGORIES.forEach((c) => {
      c.templates.forEach((t) => {
        if (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q)
        ) all.push({ cat: c.label, tpl: t });
      });
    });
    return all;
  }, [search]);

  function handleApply(mode: 'replace' | 'append') {
    if (!selected) return;
    onApplyTemplate(selected.modules.map((m) => ({ ...m })), mode);
    toast.success(`Template "${selected.name}" aplicado (${selected.modules.length} módulo${selected.modules.length > 1 ? 's' : ''})`);
    setOpen(false);
    setSelected(null);
    setSearch('');
  }

  const renderCard = (tpl: ModuleTemplate, catLabel?: string) => {
    const isSelected = selected?.id === tpl.id;
    return (
      <Card
        key={tpl.id}
        onClick={() => setSelected(tpl)}
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border'
        }`}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-2xl">{tpl.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{tpl.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary" className="text-[10px]">
              <Layers className="h-2.5 w-2.5 mr-1" />
              {tpl.modules.length} módulo{tpl.modules.length > 1 ? 's' : ''}
            </Badge>
            {catLabel && <Badge variant="outline" className="text-[10px]">{catLabel}</Badge>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full border-primary/40 text-primary hover:bg-primary/5">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Biblioteca de Móveis ({totalModules}+ modelos)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Biblioteca de Módulos — {totalModules} modelos prontos
          </DialogTitle>
          <DialogDescription>
            Escolha um modelo, personalize as dimensões e aplique ao orçamento.
          </DialogDescription>
        </DialogHeader>

        {/* Busca global */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo (ex: cozinha, gaveteiro, closet, banheiro...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {searchResults ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map(({ cat, tpl }) => renderCard(tpl, cat))}
            </div>
          </div>
        ) : (
          <Tabs value={activeCat} onValueChange={setActiveCat} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 h-auto">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-[10px] flex-col h-auto py-1.5 gap-0.5">
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-[9px] text-muted-foreground">({cat.templates.length})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {TEMPLATE_CATEGORIES.map((cat) => (
              <TabsContent key={cat.id} value={cat.id} className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.templates.map((tpl) => renderCard(tpl))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {selected && (
          <div className="border-t border-border pt-4 mt-2 space-y-3 sticky bottom-0 bg-background pb-2">
            <div className="bg-accent/30 rounded-md p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Pré-visualização: {selected.name}
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selected.modules.map((mm, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {i + 1}. {mm.type.replace(/_/g, ' ')}
                      {mm.doors ? ` · ${mm.doors}p` : ''}
                      {mm.drawers ? ` · ${mm.drawers}g` : ''}
                    </span>
                    <span className="font-mono">
                      {mm.width}×{mm.height}×{mm.depth}mm
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {hasExistingModules && (
                <Button type="button" variant="outline" className="flex-1" onClick={() => handleApply('append')}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar aos atuais
                </Button>
              )}
              <Button
                type="button"
                className="flex-1 bg-primary text-primary-foreground"
                onClick={() => handleApply(hasExistingModules ? 'replace' : 'append')}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {hasExistingModules ? 'Substituir tudo' : 'Aplicar template'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
