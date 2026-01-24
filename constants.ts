
import { Product, StoreInfo, Table } from './types';

export const STORE_INFO: StoreInfo = {
  name: 'Delícias Caseiras',
  slogan: 'Criações deliciosas com um sorriso ✨',
  hours: 'Aberto de 6h às 22h | Todos os dias',
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
    id: 'cb1',
    name: 'Combo Café Completo',
    description: '1 Café Expresso + 1 Pão de Queijo + 1 Suco de Laranja.',
    price: 16.90,
    category: 'Combos',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    savings: 'Economize R$ 3,10',
    isAvailable: true
  }
];
