
import { Product, StoreInfo, Table } from './types';

export const STORE_INFO: StoreInfo = {
  name: 'Ju Fitness',
  slogan: 'SAÚDE QUE CABE NO POTINHO 🥗',
  hours: 'Aberto de 08h às 20h | Seg a Sáb',
  whatsapp: '5585997644326'
};

export const INITIAL_TABLES: Table[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    status: 'free' as const,
    currentOrder: null
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: 900 + i,
    status: 'free' as const,
    currentOrder: null
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: 950 + i,
    status: 'free' as const,
    currentOrder: null
  }))
];

export const MENU_ITEMS: Product[] = [
  {
    id: 'kit1',
    name: 'Plano Semanal (Opção 1)',
    description: '7 Marmitas Fit variadas. Ideal para manter o foco durante a semana útil.',
    price: 84.99,
    category: 'Kits & Planos',
    image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=400&h=300&fit=crop',
    savings: 'Sai por R$ 12,14 cada',
    isAvailable: true
  },
  {
    id: 'kit2',
    name: 'Plano Mensal (Opção 2)',
    description: '30 Marmitas Fit. O melhor custo-benefício para sua rotina saudável.',
    price: 319.99,
    category: 'Kits & Planos',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
    savings: 'Economia de R$ 45,00',
    isAvailable: true
  },
  {
    id: 'm1',
    name: 'Marmita Frango com Batata Doce',
    description: 'Frango grelhado, purê de batata doce e mix de legumes no vapor.',
    price: 18.00,
    category: 'Marmitas Fit',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
    isAvailable: true
  }
];
