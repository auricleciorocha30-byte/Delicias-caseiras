
import { Product, StoreInfo, Table } from './types';

export const STORE_INFO: StoreInfo = {
  name: 'Ju Marmitas Caseiras',
  slogan: 'SAÚDE E SABOR NO SEU DIA A DIA 🥗',
  hours: 'Segunda a Sábado | 10:30h às 14:30h',
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

export const MENU_ITEMS: Product[] = []; // Os itens virão do Supabase
