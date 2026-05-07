import type { ModuleConfig } from './ModuleConfigurator';

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  modules: ModuleConfig[];
}

export interface TemplateCategory {
  id: string;
  label: string;
  icon: string;
  templates: ModuleTemplate[];
}

// Helpers para evitar repetição
const m = (
  type: string,
  height: number,
  width: number,
  depth: number,
  doors = 0,
  drawers = 0,
  shelves = 0,
  thickness = 18,
): ModuleConfig => ({ type, height, width, depth, thickness, shelves, doors, drawers });

/**
 * Biblioteca profissional de módulos pré-configurados (estilo CorteCloud / Promob).
 * Dimensões em mm. Todos os módulos são paramétricos e editáveis após inserção.
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  // ============ ARMÁRIOS BASE (genéricos) ============
  {
    id: 'base',
    label: 'Armários Base',
    icon: '📦',
    templates: [
      { id: 'base-1col', name: 'Armário 1 Coluna', description: '1 vão, 4 prateleiras', icon: '🗄️',
        modules: [m('estante', 2200, 600, 600, 0, 0, 4)] },
      { id: 'base-2col', name: 'Armário 2 Colunas', description: '2 vãos lado a lado', icon: '🗄️',
        modules: [m('estante', 2200, 1200, 600, 0, 0, 4)] },
      { id: 'base-3col', name: 'Armário 3 Colunas', description: '3 vãos amplos', icon: '🗄️',
        modules: [m('estante', 2200, 1800, 600, 0, 0, 4)] },
      { id: 'base-4col', name: 'Armário 4 Colunas', description: '4 vãos para closet/depósito', icon: '🗄️',
        modules: [m('estante', 2200, 2400, 600, 0, 0, 4)] },
      { id: 'base-1col-portas', name: 'Armário 1 Coluna c/ Porta', description: '1 vão fechado', icon: '🚪',
        modules: [m('estante', 2200, 600, 600, 1, 0, 4)] },
      { id: 'base-2col-portas', name: 'Armário 2 Colunas c/ Portas', description: '2 portas', icon: '🚪',
        modules: [m('estante', 2200, 1200, 600, 2, 0, 4)] },
      { id: 'base-3col-portas', name: 'Armário 3 Colunas c/ Portas', description: '3 portas', icon: '🚪',
        modules: [m('estante', 2200, 1800, 600, 3, 0, 4)] },
      { id: 'base-4col-portas', name: 'Armário 4 Colunas c/ Portas', description: '4 portas', icon: '🚪',
        modules: [m('estante', 2200, 2400, 600, 4, 0, 4)] },
      { id: 'base-2col-gav', name: 'Armário 2 Colunas + Gavetas', description: 'Portas + 4 gavetas', icon: '🗄️',
        modules: [
          m('estante', 1500, 1200, 600, 2, 0, 3),
          m('gaveteiro', 700, 1200, 600, 0, 4),
        ] },
      { id: 'base-canto-l', name: 'Armário Canto em L', description: 'Otimizado para cantos', icon: '📐',
        modules: [
          m('estante', 2200, 900, 600, 1, 0, 4),
          m('estante', 2200, 900, 900, 0, 0, 4),
        ] },
      { id: 'base-canto-90', name: 'Canto 90° Diagonal', description: 'Acesso diagonal', icon: '📐',
        modules: [m('estante', 2200, 900, 900, 1, 0, 4)] },
      { id: 'base-baixa', name: 'Armário Baixo', description: 'Altura padrão balcão', icon: '🗃️',
        modules: [m('balcao', 900, 1200, 500, 2, 0, 1)] },
      { id: 'base-meio', name: 'Armário Meia Altura', description: '1500mm com nicho', icon: '🗃️',
        modules: [m('estante', 1500, 800, 500, 1, 0, 3)] },
      { id: 'base-alto', name: 'Armário Alto Estreito', description: 'Coluna estreita', icon: '🗄️',
        modules: [m('estante', 2400, 400, 500, 1, 0, 5)] },
      { id: 'base-aberto', name: 'Estante Aberta', description: 'Sem portas, expositiva', icon: '📚',
        modules: [m('estante', 2200, 1200, 350, 0, 0, 5)] },
    ],
  },

  // ============ COZINHA ============
  {
    id: 'cozinha',
    label: 'Cozinha',
    icon: '🍳',
    templates: [
      { id: 'cz-aer-1p', name: 'Aéreo 1 Porta', description: '400×700×350', icon: '🍽️',
        modules: [m('armario_superior', 700, 400, 350, 1, 0, 2)] },
      { id: 'cz-aer-2p', name: 'Aéreo 2 Portas', description: '800×700×350', icon: '🍽️',
        modules: [m('armario_superior', 700, 800, 350, 2, 0, 2)] },
      { id: 'cz-aer-3p', name: 'Aéreo 3 Portas', description: '1200×700×350', icon: '🍽️',
        modules: [m('armario_superior', 700, 1200, 350, 3, 0, 2)] },
      { id: 'cz-aer-basc', name: 'Aéreo Basculante', description: 'Porta horizontal', icon: '🍽️',
        modules: [m('armario_superior', 400, 800, 350, 1, 0, 1)] },
      { id: 'cz-aer-canto', name: 'Aéreo de Canto', description: 'Canto L superior', icon: '🍽️',
        modules: [m('armario_superior', 700, 700, 700, 1, 0, 2)] },
      { id: 'cz-bal-2p', name: 'Balcão 2 Portas', description: '800×850×550', icon: '🗄️',
        modules: [m('armario_inferior', 850, 800, 550, 2, 0, 1)] },
      { id: 'cz-bal-3p', name: 'Balcão 3 Portas', description: '1200×850×550', icon: '🗄️',
        modules: [m('armario_inferior', 850, 1200, 550, 3, 0, 1)] },
      { id: 'cz-bal-pia', name: 'Balcão Pia', description: 'Sob cuba', icon: '🚰',
        modules: [m('armario_inferior', 850, 1500, 550, 2, 0, 0)] },
      { id: 'cz-bal-cook', name: 'Balcão Cooktop', description: 'Sob cooktop 4 bocas', icon: '🔥',
        modules: [m('armario_inferior', 850, 700, 550, 0, 1, 0)] },
      { id: 'cz-gav3', name: 'Gaveteiro 3 Gavetas', description: '500×850×550', icon: '🗃️',
        modules: [m('gaveteiro', 850, 500, 550, 0, 3)] },
      { id: 'cz-gav4', name: 'Gaveteiro 4 Gavetas', description: '600×850×550', icon: '🗃️',
        modules: [m('gaveteiro', 850, 600, 550, 0, 4)] },
      { id: 'cz-gav5', name: 'Gaveteiro 5 Gavetas', description: '600×850×550', icon: '🗃️',
        modules: [m('gaveteiro', 850, 600, 550, 0, 5)] },
      { id: 'cz-torre-quente', name: 'Torre Quente', description: 'Forno + microondas', icon: '🔥',
        modules: [m('estante', 2200, 600, 600, 2, 1, 2)] },
      { id: 'cz-torre-forno', name: 'Torre Forno + Aéreo', description: 'Forno embutido', icon: '🔥',
        modules: [m('estante', 2200, 600, 600, 2, 0, 1)] },
      { id: 'cz-despenseiro', name: 'Despenseiro', description: 'Armário alto despensa', icon: '🥫',
        modules: [m('estante', 2200, 800, 600, 4, 0, 5)] },
      { id: 'cz-canto-bal', name: 'Balcão de Canto', description: 'Canto L inferior', icon: '📐',
        modules: [
          m('armario_inferior', 850, 900, 600, 1, 0, 1),
          m('armario_inferior', 850, 900, 900, 1, 0, 1),
        ] },
      { id: 'cz-compacta', name: 'Cozinha Compacta', description: 'Kit 2 aéreos + 2 inferiores', icon: '🏠',
        modules: [
          m('armario_superior', 700, 800, 350, 2, 0, 2),
          m('armario_superior', 700, 600, 350, 2, 0, 2),
          m('armario_inferior', 850, 800, 550, 2, 0, 1),
          m('armario_inferior', 850, 600, 550, 2, 0, 1),
          m('bancada', 40, 1400, 600, 0, 0, 0),
        ] },
      { id: 'cz-padrao', name: 'Cozinha Padrão', description: '4 aéreos + 4 inferiores + gaveteiro', icon: '🍽️',
        modules: [
          m('armario_superior', 700, 600, 350, 2, 0, 2),
          m('armario_superior', 700, 600, 350, 2, 0, 2),
          m('armario_superior', 700, 800, 350, 2, 0, 2),
          m('armario_superior', 700, 400, 350, 1, 0, 2),
          m('armario_inferior', 850, 600, 550, 2, 0, 1),
          m('armario_inferior', 850, 800, 550, 2, 0, 1),
          m('armario_inferior', 850, 600, 550, 2, 0, 1),
          m('gaveteiro', 850, 400, 550, 0, 4),
        ] },
      { id: 'cz-completa', name: 'Cozinha Completa', description: 'Linha completa c/ torre e despenseiro', icon: '👨‍🍳',
        modules: [
          m('armario_superior', 700, 800, 350, 2, 0, 2),
          m('armario_superior', 700, 600, 350, 2, 0, 2),
          m('armario_superior', 700, 800, 350, 2, 0, 2),
          m('armario_inferior', 850, 800, 550, 2, 0, 1),
          m('armario_inferior', 850, 600, 550, 2, 0, 1),
          m('gaveteiro', 850, 600, 550, 0, 4),
          m('estante', 2200, 600, 600, 2, 1, 2),
          m('estante', 2200, 800, 600, 4, 0, 5),
          m('bancada', 40, 2800, 600, 0, 0, 0),
        ] },
      { id: 'cz-ilha', name: 'Ilha Central', description: 'Ilha com cooktop e gavetas', icon: '🏝️',
        modules: [
          m('armario_inferior', 900, 1500, 900, 0, 4, 0),
          m('bancada', 40, 1800, 1000, 0, 0, 0),
        ] },
    ],
  },

  // ============ DORMITÓRIO ============
  {
    id: 'dormitorio',
    label: 'Dormitório',
    icon: '🛏️',
    templates: [
      { id: 'dr-gr-2p', name: 'Guarda-Roupa 2 Portas', description: '1000×2200×600', icon: '👕',
        modules: [m('estante', 2200, 1000, 600, 2, 0, 3)] },
      { id: 'dr-gr-3p', name: 'Guarda-Roupa 3 Portas', description: '1500×2400×600', icon: '👕',
        modules: [m('estante', 2400, 1500, 600, 3, 0, 4)] },
      { id: 'dr-gr-4p', name: 'Guarda-Roupa 4 Portas', description: '1800×2400×600', icon: '👔',
        modules: [m('estante', 2400, 1800, 600, 4, 0, 4)] },
      { id: 'dr-gr-6p', name: 'Guarda-Roupa 6 Portas + Gav', description: '2400×2400×600', icon: '👔',
        modules: [
          m('estante', 2400, 2400, 600, 6, 0, 5),
          m('gaveteiro', 1200, 600, 550, 0, 5),
        ] },
      { id: 'dr-gr-8p', name: 'Guarda-Roupa 8 Portas', description: '3200×2600×650', icon: '👔',
        modules: [
          m('estante', 2600, 3200, 650, 8, 0, 6),
          m('gaveteiro', 1200, 800, 600, 0, 5),
        ] },
      { id: 'dr-gr-canto', name: 'Guarda-Roupa de Canto', description: 'Canto L', icon: '📐',
        modules: [
          m('estante', 2400, 1500, 600, 3, 0, 4),
          m('estante', 2400, 1500, 900, 0, 0, 4),
        ] },
      { id: 'dr-cabec-cri', name: 'Cabeceira + 2 Criados', description: 'Conjunto cama queen', icon: '🛌',
        modules: [
          m('painel', 1200, 1800, 25, 0, 0, 0, 18),
          m('gaveteiro', 500, 500, 400, 0, 2),
          m('gaveteiro', 500, 500, 400, 0, 2),
        ] },
      { id: 'dr-cabec-king', name: 'Cabeceira King + Criados', description: 'Cama king 2,00m', icon: '🛌',
        modules: [
          m('painel', 1400, 2200, 25, 0, 0, 0, 18),
          m('gaveteiro', 600, 600, 450, 0, 3),
          m('gaveteiro', 600, 600, 450, 0, 3),
        ] },
      { id: 'dr-comoda4', name: 'Cômoda 4 Gavetas', description: '1200×900×500', icon: '🗃️',
        modules: [m('gaveteiro', 900, 1200, 500, 0, 4)] },
      { id: 'dr-comoda6', name: 'Cômoda 6 Gavetas', description: '1500×1100×500', icon: '🗃️',
        modules: [m('gaveteiro', 1100, 1500, 500, 0, 6)] },
      { id: 'dr-sapateira', name: 'Sapateira', description: 'Armário baixo p/ sapatos', icon: '👟',
        modules: [m('estante', 1200, 800, 350, 2, 0, 4)] },
      { id: 'dr-bicama', name: 'Cabeceira Solteiro', description: 'Bicama infantil', icon: '🛏️',
        modules: [
          m('painel', 1000, 900, 25, 0, 0, 0, 18),
          m('gaveteiro', 400, 400, 350, 0, 2),
        ] },
      { id: 'dr-quarto-completo', name: 'Quarto Completo', description: 'GR + cabeceira + cômoda', icon: '✨',
        modules: [
          m('estante', 2400, 1800, 600, 4, 0, 4),
          m('gaveteiro', 1200, 600, 550, 0, 5),
          m('painel', 1200, 1800, 25, 0, 0, 0, 18),
          m('gaveteiro', 500, 500, 400, 0, 2),
          m('gaveteiro', 500, 500, 400, 0, 2),
          m('gaveteiro', 900, 1200, 500, 0, 4),
        ] },
    ],
  },

  // ============ CLOSET ============
  {
    id: 'closet',
    label: 'Closet',
    icon: '🚪',
    templates: [
      { id: 'cl-cabideiro', name: 'Cabideiro', description: 'Vão alto p/ cabides', icon: '👗',
        modules: [m('estante', 2400, 900, 600, 0, 0, 1)] },
      { id: 'cl-prateleiras', name: 'Painel Prateleiras', description: '5 prateleiras abertas', icon: '📚',
        modules: [m('estante', 2400, 900, 600, 0, 0, 5)] },
      { id: 'cl-gav-vidro', name: 'Gaveteiro Frente Vidro', description: '5 gavetas com frente vidro', icon: '🪟',
        modules: [m('gaveteiro', 1200, 1000, 600, 0, 5)] },
      { id: 'cl-sapateira-diag', name: 'Sapateira Diagonal', description: 'Pratel. inclinadas', icon: '👠',
        modules: [m('estante', 2200, 1000, 400, 0, 0, 6)] },
      { id: 'cl-l', name: 'Closet em L', description: 'Compacto em L com gaveteiro', icon: '📐',
        modules: [
          m('estante', 2400, 2000, 600, 0, 0, 4),
          m('estante', 2400, 1500, 600, 0, 0, 4),
          m('gaveteiro', 1000, 800, 550, 0, 5),
        ] },
      { id: 'cl-u', name: 'Closet em U', description: '3 lados de armário', icon: '🆙',
        modules: [
          m('estante', 2600, 2000, 600, 0, 0, 5),
          m('estante', 2600, 1500, 600, 0, 0, 5),
          m('estante', 2600, 2000, 600, 0, 0, 5),
          m('gaveteiro', 1000, 1000, 600, 0, 6),
        ] },
      { id: 'cl-completo', name: 'Closet Completo', description: '4 lados + ilha central', icon: '✨',
        modules: [
          m('estante', 2600, 2500, 600, 0, 0, 5),
          m('estante', 2600, 2500, 600, 0, 0, 5),
          m('estante', 2600, 1800, 600, 0, 0, 5),
          m('gaveteiro', 900, 1200, 600, 0, 6),
        ] },
      { id: 'cl-ilha', name: 'Ilha Central Closet', description: 'Ilha 6 gavetas', icon: '🏝️',
        modules: [m('gaveteiro', 900, 1500, 800, 0, 6)] },
      { id: 'cl-camiseiro', name: 'Camiseiro', description: '8 gavetas estreitas', icon: '👕',
        modules: [m('gaveteiro', 1800, 600, 500, 0, 8)] },
    ],
  },

  // ============ BANHEIRO ============
  {
    id: 'banheiro',
    label: 'Banheiro',
    icon: '🚿',
    templates: [
      { id: 'bn-gab-simples', name: 'Gabinete Simples', description: '600×600×450', icon: '🪞',
        modules: [m('balcao', 600, 600, 450, 2, 0, 1)] },
      { id: 'bn-gab-padrao', name: 'Gabinete Padrão', description: '800×600×450', icon: '🪞',
        modules: [
          m('balcao', 600, 800, 450, 2, 0, 1),
          m('armario_superior', 700, 800, 150, 2, 0, 1),
        ] },
      { id: 'bn-gab-duplo', name: 'Gabinete Duplo', description: '1500 cuba dupla + torre', icon: '🛁',
        modules: [
          m('balcao', 600, 1500, 500, 4, 0, 1),
          m('estante', 1800, 400, 350, 1, 0, 4),
          m('armario_superior', 800, 1500, 150, 3, 0, 2),
        ] },
      { id: 'bn-gab-gav', name: 'Gabinete c/ Gavetas', description: 'Gabinete 3 gavetas', icon: '🚿',
        modules: [m('balcao', 600, 800, 450, 0, 3, 0)] },
      { id: 'bn-espelheira', name: 'Espelheira', description: 'Armário aéreo p/ espelho', icon: '🪞',
        modules: [m('armario_superior', 800, 1000, 150, 2, 0, 2)] },
      { id: 'bn-torre-alta', name: 'Torre Alta Banheiro', description: '1800×400×350', icon: '🗄️',
        modules: [m('estante', 1800, 400, 350, 1, 0, 5)] },
      { id: 'bn-nicho', name: 'Nicho de Box', description: 'Nicho aberto ducha', icon: '🧴',
        modules: [m('estante', 600, 300, 150, 0, 0, 2, 15)] },
      { id: 'bn-completo', name: 'Banheiro Completo', description: 'Gab. duplo + torre + espelheira', icon: '✨',
        modules: [
          m('balcao', 600, 1500, 500, 4, 0, 1),
          m('estante', 1800, 400, 350, 1, 0, 4),
          m('armario_superior', 800, 1500, 150, 3, 0, 2),
          m('estante', 600, 300, 150, 0, 0, 2, 15),
        ] },
    ],
  },

  // ============ HOME / SALA ============
  {
    id: 'home',
    label: 'Home / Sala',
    icon: '📺',
    templates: [
      { id: 'hm-painel-tv', name: 'Painel de TV Liso', description: '2200×2800', icon: '📺',
        modules: [m('painel', 2200, 2800, 25, 0, 0, 0, 18)] },
      { id: 'hm-painel-rip', name: 'Painel TV Ripado', description: 'Ripas verticais', icon: '📺',
        modules: [m('painel', 2400, 2800, 25, 0, 0, 0, 18)] },
      { id: 'hm-rack-susp', name: 'Rack Suspenso', description: 'Rack 3 portas', icon: '🎬',
        modules: [m('balcao', 400, 1800, 400, 3, 0, 1)] },
      { id: 'hm-rack-gav', name: 'Rack c/ Gavetas', description: 'Rack 4 gavetas', icon: '🎬',
        modules: [m('balcao', 450, 2000, 400, 0, 4, 0)] },
      { id: 'hm-tv-painel', name: 'Painel + Rack + Nicho', description: 'Conjunto home theater', icon: '📺',
        modules: [
          m('painel', 2200, 2800, 25, 0, 0, 0, 18),
          m('gaveteiro', 450, 2000, 400, 0, 4),
          m('estante', 800, 600, 350, 0, 0, 2),
        ] },
      { id: 'hm-estante-livros', name: 'Estante de Livros', description: '5 prateleiras altas', icon: '📚',
        modules: [m('estante', 2400, 1800, 350, 0, 0, 5)] },
      { id: 'hm-estante-mista', name: 'Estante Mista', description: 'Aberta + fechada', icon: '📚',
        modules: [
          m('estante', 2400, 1200, 350, 0, 0, 5),
          m('estante', 2400, 800, 350, 2, 0, 4),
        ] },
      { id: 'hm-aparador', name: 'Aparador', description: 'Buffet 3 portas', icon: '🍷',
        modules: [m('balcao', 850, 1600, 450, 3, 0, 1)] },
      { id: 'hm-bar', name: 'Bar / Adega', description: 'Bar c/ porta basc + nichos', icon: '🍷',
        modules: [
          m('estante', 2200, 800, 500, 2, 0, 4),
          m('balcao', 900, 1200, 500, 2, 1, 1),
        ] },
      { id: 'hm-painel-canto', name: 'Painel TV Canto', description: 'Painel angulado', icon: '📺',
        modules: [
          m('painel', 2200, 2000, 25, 0, 0, 0, 18),
          m('balcao', 450, 1500, 400, 2, 0, 1),
        ] },
      { id: 'hm-sala-completa', name: 'Sala Completa', description: 'Painel + rack + estantes laterais', icon: '✨',
        modules: [
          m('painel', 2400, 3200, 25, 0, 0, 0, 18),
          m('gaveteiro', 450, 2400, 450, 0, 4),
          m('estante', 2200, 600, 350, 1, 0, 5),
          m('estante', 2200, 600, 350, 1, 0, 5),
        ] },
      { id: 'hm-mesa-jantar', name: 'Buffet + Cristaleira', description: 'Buffet baixo + vitrine alta', icon: '🍽️',
        modules: [
          m('balcao', 850, 1800, 500, 4, 0, 1),
          m('estante', 1800, 1800, 400, 4, 0, 4),
        ] },
    ],
  },

  // ============ ESCRITÓRIO ============
  {
    id: 'escritorio',
    label: 'Escritório',
    icon: '💼',
    templates: [
      { id: 'es-mesa-reta', name: 'Mesa Reta', description: '1400×740×600', icon: '🖥️',
        modules: [m('bancada', 40, 1400, 600, 0, 0, 0, 25)] },
      { id: 'es-mesa-l', name: 'Mesa em L', description: 'Mesa em L 1800+1400', icon: '🖥️',
        modules: [
          m('bancada', 40, 1800, 600, 0, 0, 0, 25),
          m('bancada', 40, 1400, 600, 0, 0, 0, 25),
        ] },
      { id: 'es-mesa-u', name: 'Mesa em U', description: 'Mesa diretor em U', icon: '🖥️',
        modules: [
          m('bancada', 40, 2000, 700, 0, 0, 0, 30),
          m('bancada', 40, 1600, 600, 0, 0, 0, 25),
          m('bancada', 40, 1600, 600, 0, 0, 0, 25),
        ] },
      { id: 'es-gav-volante', name: 'Gaveteiro Volante', description: '3 gavetas c/ rodízio', icon: '🗃️',
        modules: [m('gaveteiro', 600, 400, 500, 0, 3)] },
      { id: 'es-arq', name: 'Armário Arquivo', description: '1500 c/ pasta suspensa', icon: '🗂️',
        modules: [m('estante', 1500, 800, 450, 2, 2, 2)] },
      { id: 'es-est-alta', name: 'Estante Alta', description: '5 prateleiras 2400mm', icon: '📚',
        modules: [m('estante', 2400, 1200, 350, 0, 0, 5)] },
      { id: 'es-credenza', name: 'Credenza', description: 'Buffet baixo escritório', icon: '🗄️',
        modules: [m('balcao', 700, 2000, 450, 4, 0, 1)] },
      { id: 'es-home-office', name: 'Home Office Compacto', description: 'Bancada + gaveteiro + estante', icon: '💻',
        modules: [
          m('bancada', 40, 1600, 600, 0, 0, 0, 25),
          m('gaveteiro', 720, 400, 550, 0, 3),
          m('estante', 1800, 1200, 350, 0, 0, 4),
        ] },
      { id: 'es-home-l', name: 'Home Office em L', description: 'Mesa L + aéreos', icon: '🖥️',
        modules: [
          m('bancada', 40, 1800, 600, 0, 0, 0, 25),
          m('bancada', 40, 1400, 600, 0, 0, 0, 25),
          m('gaveteiro', 720, 500, 550, 0, 4),
          m('armario_superior', 700, 1800, 350, 3, 0, 1),
        ] },
      { id: 'es-reuniao-6', name: 'Sala Reunião 6 Lugares', description: 'Mesa 1800×900', icon: '👥',
        modules: [m('bancada', 40, 1800, 900, 0, 0, 0, 30)] },
      { id: 'es-reuniao-8', name: 'Sala Reunião 8 Lugares', description: 'Mesa 2400×1100', icon: '👥',
        modules: [
          m('bancada', 40, 2400, 1100, 0, 0, 0, 30),
          m('balcao', 700, 2000, 450, 4, 0, 1),
        ] },
      { id: 'es-reuniao-12', name: 'Sala Reunião 12 Lugares', description: 'Mesa 3600×1200 + painel', icon: '👥',
        modules: [
          m('bancada', 40, 3600, 1200, 0, 0, 0, 30),
          m('balcao', 700, 2400, 500, 4, 0, 1),
          m('painel', 1500, 2200, 25, 0, 0, 0, 18),
        ] },
    ],
  },

  // ============ LAVANDERIA ============
  {
    id: 'lavanderia',
    label: 'Lavanderia',
    icon: '🧺',
    templates: [
      { id: 'lv-tanque', name: 'Armário sob Tanque', description: '1000×850×550', icon: '🚰',
        modules: [m('balcao', 850, 1000, 550, 2, 0, 1)] },
      { id: 'lv-aereo', name: 'Aéreo Lavanderia', description: '1200×700×350', icon: '🧴',
        modules: [m('armario_superior', 700, 1200, 350, 3, 0, 2)] },
      { id: 'lv-torre-maq', name: 'Torre Lava + Seca', description: 'Empilhada 700×2200', icon: '🌀',
        modules: [m('estante', 2400, 700, 650, 2, 0, 2)] },
      { id: 'lv-utilitario', name: 'Armário Utilitário', description: 'Vassoura + produtos', icon: '🧹',
        modules: [m('estante', 2400, 600, 400, 2, 0, 5)] },
      { id: 'lv-compacta', name: 'Lavanderia Compacta', description: 'Aéreo + balcão tanque', icon: '🧼',
        modules: [
          m('armario_superior', 700, 1200, 350, 3, 0, 2),
          m('balcao', 850, 1200, 550, 2, 0, 1),
        ] },
      { id: 'lv-completa', name: 'Lavanderia Completa', description: 'Torre + utilitário + balcão', icon: '🧴',
        modules: [
          m('estante', 2400, 700, 650, 2, 0, 2),
          m('estante', 2400, 600, 400, 2, 0, 5),
          m('armario_superior', 700, 1500, 350, 3, 0, 2),
          m('balcao', 900, 1500, 600, 3, 0, 1),
        ] },
    ],
  },

  // ============ COMERCIAL ============
  {
    id: 'comercial',
    label: 'Comercial / Loja',
    icon: '🏬',
    templates: [
      { id: 'cm-balcao-rec', name: 'Balcão Recepção', description: '2400×1100×700', icon: '🛎️',
        modules: [
          m('balcao', 1100, 2400, 700, 2, 0, 1, 25),
          m('gaveteiro', 800, 600, 500, 0, 4),
        ] },
      { id: 'cm-balcao-caixa', name: 'Balcão Caixa', description: 'Caixa 1200 com gaveta dinheiro', icon: '💰',
        modules: [m('balcao', 1100, 1200, 600, 1, 2, 1, 25)] },
      { id: 'cm-expositor', name: 'Expositor de Loja', description: 'Estante alta + balcão', icon: '🛍️',
        modules: [
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('balcao', 950, 1800, 550, 4, 0, 1),
        ] },
      { id: 'cm-vitrine', name: 'Vitrine de Vidro', description: 'Vitrine 1500 c/ iluminação', icon: '🪟',
        modules: [m('estante', 1500, 1500, 400, 1, 0, 3, 18)] },
      { id: 'cm-prateleira-loja', name: 'Prateleira de Loja', description: 'Estante 5 níveis', icon: '🏷️',
        modules: [m('estante', 2200, 1000, 400, 0, 0, 5)] },
      { id: 'cm-stand', name: 'Stand de Exposição', description: 'Display modular', icon: '🎪',
        modules: [
          m('estante', 2400, 1500, 500, 0, 0, 4),
          m('balcao', 900, 1500, 500, 2, 0, 1),
        ] },
      { id: 'cm-loja-completa', name: 'Loja Completa', description: 'Recepção + 4 expositores + caixa', icon: '✨',
        modules: [
          m('balcao', 1100, 2400, 700, 2, 0, 1, 25),
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('estante', 2600, 1200, 400, 0, 0, 5),
          m('balcao', 1100, 1200, 600, 1, 2, 1, 25),
        ] },
    ],
  },

  // ============ INFANTIL ============
  {
    id: 'infantil',
    label: 'Infantil',
    icon: '🧸',
    templates: [
      { id: 'in-gr-infantil', name: 'GR Infantil 3 Portas', description: '1500×2000×550', icon: '👶',
        modules: [m('estante', 2000, 1500, 550, 3, 0, 3)] },
      { id: 'in-bicama', name: 'Cama Bicama + GR', description: 'Conjunto bicama infantil', icon: '🛏️',
        modules: [
          m('painel', 1000, 2000, 25, 0, 0, 0, 18),
          m('estante', 2000, 1200, 550, 2, 0, 3),
          m('gaveteiro', 600, 600, 500, 0, 3),
        ] },
      { id: 'in-bercario', name: 'Berçário Completo', description: 'Berço + cômoda + GR', icon: '👶',
        modules: [
          m('estante', 2000, 1500, 550, 3, 0, 3),
          m('gaveteiro', 900, 1000, 500, 0, 4),
          m('estante', 1200, 600, 350, 0, 0, 3),
        ] },
      { id: 'in-brinquedoteca', name: 'Brinquedoteca', description: 'Estante c/ caixotes', icon: '🧸',
        modules: [m('estante', 1500, 1800, 350, 0, 0, 4)] },
    ],
  },
];
