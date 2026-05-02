import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, Layers } from 'lucide-react';
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

  function handleApply(mode: 'replace' | 'append') {
    if (!selected) return;
    onApplyTemplate(selected.modules.map(m => ({ ...m })), mode);
    toast.success(`Template "${selected.name}" aplicado (${selected.modules.length} módulo${selected.modules.length > 1 ? 's' : ''})`);
    setOpen(false);
    setSelected(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full border-primary/40 text-primary hover:bg-primary/5">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Templates de Móveis Prontos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Biblioteca de Módulos
          </DialogTitle>
          <DialogDescription>
            Escolha um modelo pronto e personalize as dimensões depois.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={TEMPLATE_CATEGORIES[0].id} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
            {TEMPLATE_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs flex-col h-auto py-2 gap-1">
                <span className="text-lg">{cat.icon}</span>
                <span>{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TEMPLATE_CATEGORIES.map(cat => (
            <TabsContent key={cat.id} value={cat.id} className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cat.templates.map(tpl => {
                  const isSelected = selected?.id === tpl.id;
                  return (
                    <Card
                      key={tpl.id}
                      onClick={() => setSelected(tpl)}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border'
                      }`}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{tpl.icon}</span>
                            <div>
                              <p className="font-semibold text-sm leading-tight">{tpl.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            <Layers className="h-2.5 w-2.5 mr-1" />
                            {tpl.modules.length} módulo{tpl.modules.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {selected && (
          <div className="border-t border-border pt-4 mt-2 space-y-3">
            <div className="bg-accent/30 rounded-md p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Pré-visualização: {selected.name}
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selected.modules.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {i + 1}. {m.type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono">
                      {m.width}×{m.height}×{m.depth}mm
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
