import type { ModuleConfig } from './ModuleConfigurator';

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji para visualização rápida
  modules: ModuleConfig[];
}

export interface TemplateCategory {
  id: string;
  label: string;
  icon: string;
  templates: ModuleTemplate[];
}

/**
 * Biblioteca de módulos pré-configurados.
 * Dimensões em milímetros (padrão da indústria de marcenaria).
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'cozinha',
    label: 'Cozinha',
    icon: '🍳',
    templates: [
      {
        id: 'cozinha-compacta',
        name: 'Cozinha Compacta',
        description: '2 superiores + 2 inferiores + bancada',
        icon: '🏠',
        modules: [
          { type: 'armario_superior', height: 700, width: 800, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 800, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'bancada', height: 40, width: 1400, depth: 600, thickness: 18, shelves: 0, doors: 0 },
        ],
      },
      {
        id: 'cozinha-padrao',
        name: 'Cozinha Padrão',
        description: '4 superiores + 4 inferiores + gaveteiro',
        icon: '🍽️',
        modules: [
          { type: 'armario_superior', height: 700, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 800, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 400, depth: 350, thickness: 18, shelves: 2, doors: 1 },
          { type: 'armario_inferior', height: 850, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 800, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'gaveteiro', height: 850, width: 400, depth: 550, thickness: 18, shelves: 0, doors: 4 },
        ],
      },
      {
        id: 'cozinha-completa',
        name: 'Cozinha Completa',
        description: 'Linha completa com torre quente e despenseiro',
        icon: '👨‍🍳',
        modules: [
          { type: 'armario_superior', height: 700, width: 800, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 800, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_superior', height: 700, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 800, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'armario_inferior', height: 850, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'gaveteiro', height: 850, width: 600, depth: 550, thickness: 18, shelves: 0, doors: 4 },
          { type: 'armario_inferior', height: 850, width: 800, depth: 550, thickness: 18, shelves: 1, doors: 2 },
          { type: 'estante', height: 2200, width: 600, depth: 600, thickness: 18, shelves: 3, doors: 2 },
          { type: 'bancada', height: 40, width: 2800, depth: 600, thickness: 18, shelves: 0, doors: 0 },
        ],
      },
    ],
  },
  {
    id: 'dormitorio',
    label: 'Dormitório',
    icon: '🛏️',
    templates: [
      {
        id: 'guarda-roupa-3-portas',
        name: 'Guarda-Roupa 3 Portas',
        description: 'Compacto para quartos pequenos',
        icon: '👕',
        modules: [
          { type: 'estante', height: 2400, width: 1500, depth: 600, thickness: 18, shelves: 4, doors: 3 },
        ],
      },
      {
        id: 'guarda-roupa-6-portas',
        name: 'Guarda-Roupa 6 Portas',
        description: 'Solução completa com gaveteiro',
        icon: '👔',
        modules: [
          { type: 'estante', height: 2400, width: 2400, depth: 600, thickness: 18, shelves: 5, doors: 6 },
          { type: 'gaveteiro', height: 1200, width: 600, depth: 550, thickness: 18, shelves: 0, doors: 5 },
        ],
      },
      {
        id: 'cabeceira-criados',
        name: 'Cabeceira + 2 Criados',
        description: 'Conjunto cabeceira com mesas laterais',
        icon: '🛌',
        modules: [
          { type: 'painel', height: 1200, width: 1800, depth: 25, thickness: 18, shelves: 0, doors: 0 },
          { type: 'gaveteiro', height: 500, width: 500, depth: 400, thickness: 18, shelves: 0, doors: 2 },
          { type: 'gaveteiro', height: 500, width: 500, depth: 400, thickness: 18, shelves: 0, doors: 2 },
        ],
      },
    ],
  },
  {
    id: 'closet',
    label: 'Closet',
    icon: '🚪',
    templates: [
      {
        id: 'closet-em-l',
        name: 'Closet em L',
        description: 'Closet compacto em L com gaveteiro',
        icon: '📐',
        modules: [
          { type: 'estante', height: 2400, width: 2000, depth: 600, thickness: 18, shelves: 4, doors: 0 },
          { type: 'estante', height: 2400, width: 1500, depth: 600, thickness: 18, shelves: 4, doors: 0 },
          { type: 'gaveteiro', height: 1000, width: 800, depth: 550, thickness: 18, shelves: 0, doors: 5 },
        ],
      },
      {
        id: 'closet-completo',
        name: 'Closet Completo',
        description: 'Closet 4 lados com ilha central',
        icon: '✨',
        modules: [
          { type: 'estante', height: 2600, width: 2500, depth: 600, thickness: 18, shelves: 5, doors: 0 },
          { type: 'estante', height: 2600, width: 2500, depth: 600, thickness: 18, shelves: 5, doors: 0 },
          { type: 'estante', height: 2600, width: 1800, depth: 600, thickness: 18, shelves: 5, doors: 0 },
          { type: 'gaveteiro', height: 900, width: 1200, depth: 600, thickness: 18, shelves: 0, doors: 6 },
        ],
      },
    ],
  },
  {
    id: 'home',
    label: 'Home / Sala',
    icon: '📺',
    templates: [
      {
        id: 'home-tv-painel',
        name: 'Home + Painel TV',
        description: 'Painel TV com nicho e gaveteiro',
        icon: '📺',
        modules: [
          { type: 'painel', height: 2200, width: 2800, depth: 25, thickness: 18, shelves: 0, doors: 0 },
          { type: 'gaveteiro', height: 450, width: 2000, depth: 400, thickness: 18, shelves: 0, doors: 4 },
          { type: 'estante', height: 800, width: 600, depth: 350, thickness: 18, shelves: 2, doors: 0 },
        ],
      },
      {
        id: 'estante-livros',
        name: 'Estante de Livros',
        description: 'Estante alta com 5 prateleiras',
        icon: '📚',
        modules: [
          { type: 'estante', height: 2400, width: 1800, depth: 350, thickness: 18, shelves: 5, doors: 0 },
        ],
      },
      {
        id: 'rack-suspenso',
        name: 'Rack Suspenso',
        description: 'Rack com 3 portas e bancada',
        icon: '🎬',
        modules: [
          { type: 'balcao', height: 400, width: 1800, depth: 400, thickness: 18, shelves: 1, doors: 3 },
          { type: 'painel', height: 1200, width: 1800, depth: 25, thickness: 18, shelves: 0, doors: 0 },
        ],
      },
    ],
  },
  {
    id: 'banheiro',
    label: 'Banheiro',
    icon: '🚿',
    templates: [
      {
        id: 'gabinete-banheiro',
        name: 'Gabinete Banheiro',
        description: 'Gabinete com cuba e espelheira',
        icon: '🪞',
        modules: [
          { type: 'balcao', height: 600, width: 800, depth: 450, thickness: 18, shelves: 1, doors: 2 },
          { type: 'armario_superior', height: 700, width: 800, depth: 150, thickness: 18, shelves: 1, doors: 2 },
        ],
      },
    ],
  },
  {
    id: 'escritorio',
    label: 'Escritório',
    icon: '💼',
    templates: [
      {
        id: 'home-office',
        name: 'Home Office',
        description: 'Bancada + gaveteiro + estante',
        icon: '💻',
        modules: [
          { type: 'bancada', height: 40, width: 1600, depth: 600, thickness: 18, shelves: 0, doors: 0 },
          { type: 'gaveteiro', height: 720, width: 400, depth: 550, thickness: 18, shelves: 0, doors: 3 },
          { type: 'estante', height: 1800, width: 1200, depth: 350, thickness: 18, shelves: 4, doors: 0 },
        ],
      },
    ],
  },
];
