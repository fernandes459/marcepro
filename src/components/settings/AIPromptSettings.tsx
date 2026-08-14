import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Save, RotateCcw, Loader2 } from 'lucide-react';
import { AI_PROMPT_KEYS, DEFAULT_ORCAMENTISTA_PROMPT } from '@/lib/ai-prompts';

/**
 * Editor da "skill" (prompt) usada pela IA Orçamentista.
 * Vazio = usa o prompt padrão do sistema.
 */
export default function AIPromptSettings() {
  const [content, setContent] = useState('');
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_prompts' as any)
      .select('content')
      .eq('key', AI_PROMPT_KEYS.orcamentistaPro)
      .maybeSingle();
    const stored = ((data as any)?.content as string) || '';
    const [main, extra] = stored.split('\n<<<REGRAS_EXTRAS>>>\n');
    setContent(main || '');
    setRules(extra || '');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Sessão expirada');
      const merged = rules.trim()
        ? `${content.trim()}\n<<<REGRAS_EXTRAS>>>\n${rules.trim()}`
        : content.trim();

      const { error } = await supabase
        .from('ai_prompts' as any)
        .upsert(
          { owner_id: uid, key: AI_PROMPT_KEYS.orcamentistaPro, content: merged, updated_at: new Date().toISOString() },
          { onConflict: 'owner_id,key' } as any,
        );
      if (error) throw error;
      toast.success('Skill da IA salva. Os próximos orçamentos já usam este prompt.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Brain className="h-4 w-4" /> Skill da IA — Orçamentista
          <Badge variant={content.trim() ? 'default' : 'secondary'} className="ml-2">
            {content.trim() ? 'Personalizada' : 'Padrão do sistema'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Aqui você controla o raciocínio da IA que calcula seus orçamentos. Deixe o campo principal vazio para usar o
          prompt padrão, ou cole a sua skill completa para substituir. As regras extras são sempre somadas ao prompt
          (ótimo para corrigir erros recorrentes: preços de chapa, perdas, ferragens que ela esquece, etc.).
        </p>

        <div className="space-y-2">
          <Label>Prompt principal (skill completa)</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            disabled={loading}
            placeholder="Vazio = prompt padrão do sistema. Cole aqui a sua skill para substituir."
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setContent(DEFAULT_ORCAMENTISTA_PROMPT)}>
              Carregar prompt padrão
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setContent('')}>
              <RotateCcw className="h-4 w-4 mr-1" /> Limpar (voltar ao padrão)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Regras extras / correções (sempre aplicadas)</Label>
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={8}
            disabled={loading}
            placeholder={'Ex.:\n- Chapa MDF 18mm branco TX = R$ 320,00\n- Perda técnica mínima de 15%\n- Sempre incluir fita de borda em todas as bordas aparentes\n- Corrediça telescópica 45cm = R$ 38,00 o par'}
            className="font-mono text-xs"
          />
        </div>

        <Button onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar skill
        </Button>
      </CardContent>
    </Card>
  );
}
