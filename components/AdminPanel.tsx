
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, LoyaltyUser, OrderStatus, StoreConfig, CartItem, OrderType } from '../types';
import { CloseIcon, TrashIcon, VolumeIcon, EditIcon, BackupIcon, RestoreIcon } from './Icons';
import { supabase } from '../lib/supabase';
import { STORE_INFO } from '../constants';

interface AdminPanelProps {
  tables: Table[];
  menuItems: Product[];
  categories: Category[];
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onTestSound: () => void;
  onUpdateTable: (tableId: number, status: 'free' | 'occupied', order?: Order | null) => void;
  onAddToOrder: (tableId: number, product: Product, observation?: string) => void;
  onRefreshData: () => void;
  onLogout: () => void;
  onSaveProduct: (product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  dbStatus: 'loading' | 'ok';
  storeConfig: StoreConfig;
  onUpdateStoreConfig: (newCfg: StoreConfig) => void;
}

const STATUS_CFG: Record<string, any> = {
  'pending': { label: 'Pendente', badge: 'bg-orange-600 text-white' },
  'preparing': { label: 'Preparando', badge: 'bg-blue-600 text-white' },
  'ready': { label: 'Pronto', badge: 'bg-green-600 text-white' },
  'delivered': { label: 'Entregue', badge: 'bg-gray-400 text-white' }
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  tables = [], menuItems = [], categories = [], audioEnabled, onToggleAudio, onTestSound,
  onUpdateTable, onRefreshData, onLogout, onSaveProduct, onDeleteProduct, dbStatus, onAddToOrder,
  storeConfig, onUpdateStoreConfig
}) => {
  const [activeTab, setActiveTab] = useState<'delivery' | 'menu' | 'marketing' | 'setup'>('delivery');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);

  // Estado para Novo Pedido Manual
  const [manualOrderData, setManualOrderData] = useState<{
    customerName: string;
    customerPhone: string;
    address: string;
    items: CartItem[];
    type: 'delivery' | 'takeaway';
    paymentMethod: string;
  }>({
    customerName: '',
    customerPhone: '',
    address: '',
    items: [],
    type: 'delivery',
    paymentMethod: 'Pix'
  });

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([]);

  useEffect(() => {
    if (activeTab === 'marketing') fetchMarketing();
  }, [activeTab]);

  const fetchMarketing = async () => {
    const { data: cData } = await supabase.from('coupons').select('*');
    if (cData) setCoupons(cData.map(c => ({ id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, scopeType: c.scope_type, scopeValue: c.scope_value || '' })));
    
    const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
    if (lConfig) setLoyalty({ isActive: lConfig.is_active, spendingGoal: lConfig.spending_goal, scopeType: lConfig.scope_type || 'all', scopeValue: lConfig.scope_value || '' });
    
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) setLoyaltyUsers(lUsers);
  };

  const handleOpenMenu = () => {
    const url = window.location.origin + window.location.pathname + '?view=menu';
    window.open(url, '_blank');
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, scope_type: next.scopeType, scope_value: next.scopeValue });
  };

  const toggleScopeValue = (currentValue: string, id: string) => {
    const vals = currentValue ? currentValue.split(',').filter(Boolean) : [];
    if (vals.includes(id)) return vals.filter(v => v !== id).join(',');
    return [...vals, id].join(',');
  };

  const handleAddManualItem = (prod: Product) => {
    setManualOrderData(prev => {
      const existing = prev.items.find(i => i.id === prod.id);
      if (existing) {
        return { ...prev, items: prev.items.map(i => i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...prev, items: [...prev.items, { ...prod, quantity: 1 }] };
    });
  };

  const handleRemoveManualItem = (id: string) => {
    setManualOrderData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const submitManualOrder = async () => {
    if (!manualOrderData.customerName || manualOrderData.items.length === 0) {
      alert("Preencha o nome e adicione itens.");
      return;
    }

    const total = manualOrderData.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const range = manualOrderData.type === 'delivery' ? [900, 949] : [950, 999];
    const freeTable = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free');
    const tid = freeTable?.id || range[0];

    const newOrder: Order = {
      id: 'MAN-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      customerName: manualOrderData.customerName,
      customerPhone: manualOrderData.customerPhone,
      items: manualOrderData.items,
      total: total,
      finalTotal: total,
      paymentMethod: manualOrderData.paymentMethod,
      timestamp: new Date().toISOString(),
      tableId: tid,
      status: 'pending',
      orderType: manualOrderData.type === 'delivery' ? 'delivery' : 'counter',
      address: manualOrderData.type === 'delivery' ? manualOrderData.address : undefined
    };

    onUpdateTable(tid, 'occupied', newOrder);
    setIsManualOrderModalOpen(false);
    setManualOrderData({ customerName: '', customerPhone: '', address: '', items: [], type: 'delivery', paymentMethod: 'Pix' });
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header Admin */}
      <div className="bg-[#1A1A1A] p-6 rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-[#FF7F11]">
        <div className="flex items-center gap-4">
          <div className="bg-[#FF7F11] p-3 rounded-2xl shadow-lg">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth="3" strokeLinecap="round"/></svg>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black italic text-white uppercase leading-none tracking-tighter">Ju Admin</h2>
            <p className="text-[9px] text-[#FF7F11] uppercase font-black tracking-[0.2em] mt-1">Gestão Marmitas</p>
          </div>
        </div>

        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-[#FF7F11] text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Cardápio' : tab === 'marketing' ? 'Mkt' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="flex gap-4">
          <button onClick={handleOpenMenu} className="bg-[#6C7A1D] text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Cardápio Público 🥗</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA DE PEDIDOS */}
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
               <div>
                  <h3 className="text-xl font-black uppercase italic text-[#1A1A1A]">Fluxo de Pedidos</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acompanhe e gerencie a cozinha</p>
               </div>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Novo Pedido Manual</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Entregas */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 ml-2 text-[#FF7F11]">
                  <span className="text-2xl">🚚</span>
                  <h4 className="font-black uppercase italic tracking-tighter">Entregas em Aberto ({deliveryOrders.length})</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {deliveryOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="bg-white p-6 rounded-[2.5rem] border-4 border-[#FF7F11] text-left flex justify-between items-center shadow-md hover:shadow-xl transition-all">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">#{t.currentOrder?.id}</p>
                        <h5 className="font-black text-lg uppercase text-[#1A1A1A]">{t.currentOrder?.customerName}</h5>
                      </div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase tracking-widest`}>
                        {STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Retiradas */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 ml-2 text-[#6C7A1D]">
                  <span className="text-2xl">🏪</span>
                  <h4 className="font-black uppercase italic tracking-tighter">Retiradas Balcão ({takeawayOrders.length})</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {takeawayOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="bg-white p-6 rounded-[2.5rem] border-4 border-[#6C7A1D] text-left flex justify-between items-center shadow-md hover:shadow-xl transition-all">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">#{t.currentOrder?.id}</p>
                        <h5 className="font-black text-lg uppercase text-[#1A1A1A]">{t.currentOrder?.customerName}</h5>
                      </div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase tracking-widest`}>
                        {STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA DE CARDÁPIO */}
        {activeTab === 'menu' && (
          <div className="space-y-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#FF7F11]">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Categorias</h3>
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-[#FF7F11] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Categoria</button>
              </div>
              <div className="flex flex-wrap gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-gray-50 px-6 py-4 rounded-2xl border flex items-center gap-4 group">
                    <span className="font-black text-[11px] uppercase tracking-widest">{cat.name}</span>
                    <button onClick={async () => { if(confirm('Excluir?')) { await supabase.from('categories').delete().eq('id', cat.id); onRefreshData(); } }} className="text-red-400 hover:text-red-600 transition-all"><TrashIcon size={18}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Gestão de Produtos</h3>
                <div className="flex gap-4 w-full md:w-auto">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="flex-1 md:w-64 bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" />
                  <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '' }); setIsProductModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:brightness-125 transition-all">+ Novo Produto</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className={`bg-gray-50 p-5 rounded-[3rem] border-2 transition-all relative group overflow-hidden shadow-sm ${!item.isAvailable ? 'opacity-50 grayscale border-red-200' : 'hover:border-[#FF7F11] border-transparent'}`}>
                    <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4 shadow-md" />
                    <h4 className="font-black text-[11px] uppercase truncate mb-1">{item.name}</h4>
                    <p className="text-[#FF7F11] font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 flex justify-center hover:bg-blue-50 transition-colors"><EditIcon size={18}/></button>
                      <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-red-500 flex justify-center hover:bg-red-50 transition-colors"><TrashIcon size={18}/></button>
                    </div>
                    {!item.isAvailable && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white text-[7px] font-black uppercase px-2 py-1 rounded-full">Indisponível</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NOVO PEDIDO MANUAL */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] p-12 relative shadow-2xl flex flex-col md:flex-row gap-10 max-h-[90vh] overflow-hidden">
             <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
             
             {/* Esquerda: Dados Cliente */}
             <div className="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar pr-4">
                <h3 className="text-2xl font-black italic uppercase">Novo Pedido Manual</h3>
                <div className="space-y-4">
                  <input placeholder="NOME DO CLIENTE" value={manualOrderData.customerName} onChange={e => setManualOrderData({...manualOrderData, customerName: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" />
                  <input placeholder="WHATSAPP" value={manualOrderData.customerPhone} onChange={e => setManualOrderData({...manualOrderData, customerPhone: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-[#FF7F11]" />
                  
                  <div className="flex gap-2">
                    <button onClick={() => setManualOrderData({...manualOrderData, type: 'delivery'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'delivery' ? 'bg-[#FF7F11] text-white border-[#FF7F11]' : 'bg-white border-gray-100'}`}>Entrega</button>
                    <button onClick={() => setManualOrderData({...manualOrderData, type: 'takeaway'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'takeaway' ? 'bg-[#6C7A1D] text-white border-[#6C7A1D]' : 'bg-white border-gray-100'}`}>Balcão</button>
                  </div>

                  {manualOrderData.type === 'delivery' && (
                    <textarea placeholder="ENDEREÇO COMPLETO" value={manualOrderData.address} onChange={e => setManualOrderData({...manualOrderData, address: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black h-24 resize-none outline-none focus:border-[#FF7F11]" />
                  )}

                  <select value={manualOrderData.paymentMethod} onChange={e => setManualOrderData({...manualOrderData, paymentMethod: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]">
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão</option>
                  </select>
                </div>

                <div className="mt-6 p-6 bg-gray-50 rounded-3xl border">
                  <h4 className="text-[10px] font-black uppercase mb-4 text-gray-400">Itens do Pedido</h4>
                  <div className="space-y-3">
                    {manualOrderData.items.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs font-black uppercase">
                        <span>{item.quantity}x {item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#FF7F11]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          <button onClick={() => handleRemoveManualItem(item.id)} className="text-red-500"><TrashIcon size={14}/></button>
                        </div>
                      </div>
                    ))}
                    {manualOrderData.items.length === 0 && <p className="text-[9px] text-gray-400 italic">Nenhum item adicionado</p>}
                  </div>
                  <div className="mt-6 pt-6 border-t flex justify-between items-end">
                    <p className="text-[10px] font-black uppercase text-gray-400">Total</p>
                    <p className="text-2xl font-black italic">R$ {manualOrderData.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                  </div>
                </div>

                <button onClick={submitManualOrder} className="w-full bg-[#1A1A1A] text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all mt-4">Lançar Pedido ✅</button>
             </div>

             {/* Direita: Seleção de Produtos */}
             <div className="flex-1 bg-gray-50 p-8 rounded-[3rem] overflow-y-auto no-scrollbar">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Selecione os Itens</h4>
                <div className="grid grid-cols-2 gap-4">
                  {menuItems.filter(i => i.isAvailable).map(prod => (
                    <button key={prod.id} onClick={() => handleAddManualItem(prod)} className="bg-white p-4 rounded-3xl border-2 border-transparent hover:border-[#FF7F11] text-left transition-all shadow-sm">
                       <img src={prod.image} className="w-full aspect-square object-cover rounded-2xl mb-3" />
                       <p className="text-[10px] font-black uppercase truncate">{prod.name}</p>
                       <p className="text-[11px] font-black italic text-[#FF7F11]">R$ {prod.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
             <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-10 uppercase text-center">{editingProduct?.id ? 'Editar' : 'Nova'} Marmita</h3>
             <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 ml-2 mb-2 block">Nome da Marmita</label>
                  <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="EX: FRANGO COM BATATA DOCE" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-[#FF7F11]" required />
                </div>
                
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 ml-2 mb-2 block">Detalhes do Produto (Descrição)</label>
                  <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCREVA OS INGREDIENTES, PESO, ETC..." className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-[#FF7F11] h-32 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-2 mb-2 block">Preço (R$)</label>
                    <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="0,00" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" required />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-2 mb-2 block">Categoria</label>
                    <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-[#FF7F11]">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 ml-2 mb-2 block">URL da Imagem</label>
                  <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="https://..." className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" />
                </div>
                
                <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl border">
                   <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6 rounded-lg accent-[#FF7F11]" />
                   <label className="text-[10px] font-black uppercase tracking-widest">Disponível no Cardápio</label>
                </div>
                
                <button type="submit" className="w-full bg-[#1A1A1A] text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all">Salvar Marmita</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES PEDIDO */}
      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
           <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 overflow-y-auto flex flex-col border-t-8 border-[#FF7F11]">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[#1A1A1A]">Pedido de {selectedOrder.currentOrder?.customerName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                      ID: #{selectedOrder.currentOrder?.id} • {selectedOrder.id >= 950 ? 'Retirada na Loja' : 'Entrega Domicílio'}
                    </p>
                 </div>
                 <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={24}/></button>
              </div>

              <div className="flex-1 space-y-8">
                 <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-4 ml-2">Atualizar Status</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-[#1A1A1A] shadow-lg' : 'bg-white text-gray-400 border-transparent hover:border-gray-200'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Itens Solicitados</h4>
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-gray-100">
                          <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
                          <div className="flex-1">
                             <p className="font-black text-sm uppercase text-[#1A1A1A]">{item.name}</p>
                             <p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                          </div>
                          <span className="font-black italic text-[#FF7F11]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>

                 {selectedOrder.currentOrder?.address && (
                   <div className="bg-[#1A1A1A] p-8 rounded-3xl text-white">
                      <p className="text-[9px] font-black uppercase text-[#FF7F11] mb-2 tracking-widest">Endereço de Entrega</p>
                      <p className="text-sm font-bold uppercase leading-relaxed">{selectedOrder.currentOrder.address}</p>
                   </div>
                 )}
              </div>

              <div className="pt-10 mt-10 border-t flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Final do Pedido</p>
                    <p className="text-4xl font-black italic text-[#1A1A1A]">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                 </div>
                 <button onClick={() => { if(confirm('Concluir e arquivar pedido?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-[#6C7A1D] text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Concluir Pedido ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
