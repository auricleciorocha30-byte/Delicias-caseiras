
import React, { useState, useEffect } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, OrderStatus, StoreConfig, CartItem, LoyaltyUser } from '../types';
import { CloseIcon, TrashIcon, VolumeIcon, EditIcon, PrinterIcon } from './Icons';
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
  showNewOrderAlert: boolean;
  onClearAlert: () => void;
}

const STATUS_CFG: Record<string, any> = {
  'pending': { label: 'Pendente', badge: 'bg-orange-600 text-white animate-pulse' },
  'preparing': { label: 'Preparando', badge: 'bg-blue-600 text-white' },
  'ready': { label: 'Pronto', badge: 'bg-green-600 text-white' },
  'delivered': { label: 'Entregue', badge: 'bg-gray-400 text-white' }
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  tables = [], menuItems = [], categories = [], onTestSound,
  onUpdateTable, onRefreshData, onLogout, onSaveProduct, onDeleteProduct,
  storeConfig, onUpdateStoreConfig, showNewOrderAlert, onClearAlert
}) => {
  const [activeTab, setActiveTab] = useState<'delivery' | 'menu' | 'marketing' | 'setup'>('delivery');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Marketing States
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([]);

  // Pedido Manual State
  const [manualOrderData, setManualOrderData] = useState<{
    customerName: string; customerPhone: string; address: string; items: CartItem[]; type: 'delivery' | 'takeaway'; paymentMethod: string;
  }>({
    customerName: '', customerPhone: '', address: '', items: [], type: 'delivery', paymentMethod: 'Pix'
  });

  useEffect(() => {
    if (activeTab === 'marketing') fetchMarketing();
  }, [activeTab]);

  const fetchMarketing = async () => {
    const { data: cData } = await supabase.from('coupons').select('*');
    if (cData) setCoupons(cData.map(c => ({ id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, scopeType: c.scope_type as any, scopeValue: c.scope_value || '' })));
    const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
    if (lConfig) setLoyalty({ isActive: lConfig.is_active, spendingGoal: Number(lConfig.spending_goal), scopeType: lConfig.scope_type as any, scopeValue: lConfig.scope_value || '' });
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) setLoyaltyUsers(lUsers.map(u => ({ phone: u.phone, name: u.name, accumulated: Number(u.accumulated) })));
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, scope_type: next.scopeType, scope_value: next.scopeValue });
  };

  const handleDeleteLoyaltyUser = async (phone: string) => {
    if (confirm('Deseja excluir este cliente do programa de fidelidade? O saldo será zerado.')) {
      await supabase.from('loyalty_users').delete().eq('phone', phone);
      fetchMarketing();
    }
  };

  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500 relative pb-10">
      {/* ALERTA DE NOVO PEDIDO */}
      {showNewOrderAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
          <button onClick={onClearAlert} className="w-full bg-[#FF7F11] text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border-4 border-white animate-bounce">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full"><VolumeIcon size={24} className="text-[#FF7F11]" /></div>
              <div className="text-left">
                <p className="font-black uppercase text-xs tracking-widest">Atenção!</p>
                <p className="font-black text-xl italic leading-none">NOVO PEDIDO CHEGOU!</p>
              </div>
            </div>
            <span className="bg-brand-dark px-4 py-2 rounded-2xl text-[10px] font-black uppercase">OK</span>
          </button>
        </div>
      )}

      {/* HEADER ADMIN */}
      <div className="bg-[#1A1A1A] p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-[#FF7F11]">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <button onClick={onTestSound} className="bg-[#FF7F11] p-3 rounded-2xl shadow-lg hover:scale-110 transition-all"><VolumeIcon size={24} className="text-white"/></button>
            <div className="text-left">
              <h2 className="text-xl font-black italic text-[#FF7F11] uppercase leading-none tracking-tighter">Ju Admin</h2>
              <p className="text-[9px] text-white uppercase font-black tracking-[0.2em] mt-1">Gestão Marmitas</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-4 py-3 rounded-xl">Sair</button>
        </div>
        
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-[#FF7F11] text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Produtos' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA MARKETING */}
        {activeTab === 'marketing' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] shadow-xl border-t-8 border-[#6C7A1D]">
                <h3 className="text-xl md:text-2xl font-black italic uppercase mb-10">💎 Fidelidade Ju</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2">Meta de Gastos (R$)</p>
                    <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 p-4 rounded-2xl font-black text-xl outline-none focus:border-[#6C7A1D]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2">Aplicar em:</p>
                    <select value={loyalty.scopeType} onChange={e => handleUpdateLoyalty({ scopeType: e.target.value as any, scopeValue: '' })} className="w-full bg-gray-50 border-2 p-4 rounded-2xl font-black text-xs uppercase outline-none focus:border-[#6C7A1D]">
                      <option value="all">Todo o Cardápio</option>
                      <option value="category">Uma Categoria</option>
                      <option value="product">Um Produto</option>
                    </select>
                  </div>
                  {loyalty.scopeType === 'category' && (
                    <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 p-4 rounded-2xl font-black text-xs uppercase outline-none focus:border-[#6C7A1D]">
                      <option value="">Selecione a Categoria...</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                  {loyalty.scopeType === 'product' && (
                    <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 p-4 rounded-2xl font-black text-xs uppercase outline-none focus:border-[#6C7A1D]">
                      <option value="">Selecione o Produto...</option>
                      {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] shadow-xl border-t-8 border-[#FF7F11]">
                 <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl md:text-2xl font-black italic uppercase">🎫 Cupons Ju</h3>
                    <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg">+ Novo Cupom</button>
                 </div>
                 <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                    {coupons.map(c => (
                      <div key={c.id} className="p-5 bg-gray-50 rounded-2xl border flex justify-between items-center">
                        <div>
                          <p className="font-black uppercase text-xs">{c.code} - {c.percentage}% OFF</p>
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{c.scopeType === 'all' ? 'Todos' : c.scopeValue}</p>
                        </div>
                        <button onClick={async () => { await supabase.from('coupons').delete().eq('id', c.id); fetchMarketing(); }} className="text-red-500 hover:scale-110 transition-all"><TrashIcon size={18}/></button>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
              <h3 className="text-xl md:text-2xl font-black italic uppercase mb-8">👥 Participantes Fidelidade</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {loyaltyUsers.map(u => (
                   <div key={u.phone} className="bg-gray-50 p-6 rounded-[2rem] border-2 border-transparent hover:border-[#FF7F11] transition-all flex justify-between items-center group">
                      <div>
                        <h4 className="font-black text-sm uppercase">{u.name || 'Cliente'}</h4>
                        <p className="text-[10px] font-bold text-gray-400">{u.phone}</p>
                        <div className="mt-2 inline-block bg-[#6C7A1D]/10 text-[#6C7A1D] px-3 py-1 rounded-full text-[9px] font-black uppercase">R$ {u.accumulated.toFixed(2)} acumulados</div>
                      </div>
                      <button onClick={() => handleDeleteLoyaltyUser(u.phone)} className="p-3 bg-white text-red-500 rounded-2xl shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon size={18} /></button>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA PRODUTOS - MEU CARDÁPIO */}
        {activeTab === 'menu' && (
          <div className="bg-white p-4 md:p-10 rounded-[2rem] md:rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
              <h3 className="text-2xl font-black italic uppercase">Minhas Marmitas</h3>
              <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 w-full md:w-auto">
                <button onClick={() => setIsCategoryModalOpen(true)} className="flex-1 md:flex-none bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-black text-[9px] uppercase">Categorias</button>
                <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '', image: '' }); setIsProductModalOpen(true); }} className="flex-1 md:flex-none bg-[#1A1A1A] text-[#FF7F11] px-4 py-3 rounded-xl font-black text-[9px] uppercase shadow-xl">+ Nova Marmita</button>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="w-full md:w-48 bg-gray-50 border-2 rounded-xl px-4 py-3 text-[10px] font-black outline-none focus:border-[#FF7F11]" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-8">
              {menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                <div key={item.id} className="bg-gray-50 p-3 md:p-5 rounded-[2rem] md:rounded-[3rem] border-2 relative shadow-sm hover:shadow-lg transition-all">
                  <div className="w-full aspect-square bg-gray-200 rounded-[1.5rem] md:rounded-[2rem] mb-3 overflow-hidden">
                    <img src={item.image} onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400/FF7F11/FFFFFF?text=' + item.name.charAt(0); }} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="font-black text-[10px] md:text-[11px] uppercase leading-tight min-h-[2.5em] line-clamp-2">{item.name}</h4>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-2 rounded-xl text-blue-500 flex justify-center shadow-sm hover:bg-blue-50 transition-all"><EditIcon size={16}/></button>
                    <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-2 rounded-xl text-red-500 flex justify-center shadow-sm hover:bg-red-50 transition-all"><TrashIcon size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA PEDIDOS */}
        {activeTab === 'delivery' && (
          <div className="space-y-12 px-2 md:px-0">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border gap-4">
               <h3 className="text-xl font-black uppercase italic">Fluxo de Marmitas</h3>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="w-full md:w-auto bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Lançar Pedido</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase text-[#FF7F11] ml-2">🚚 Entregas ({deliveryOrders.length})</h4>
                {deliveryOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-[#FF7F11] flex justify-between items-center shadow-md">
                    <div className="text-left"><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
              <div className="space-y-6">
                <h4 className="font-black uppercase text-[#6C7A1D] ml-2">🏪 Balcão ({takeawayOrders.length})</h4>
                {takeawayOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-[#6C7A1D] flex justify-between items-center shadow-md">
                    <div className="text-left"><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PRODUTO COM PREVIEW DE IMAGEM E FUNÇÃO DE ESTOQUE */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
            <h3 className="text-xl md:text-2xl font-black italic mb-8 uppercase text-center">{editingProduct?.id ? 'Editar' : 'Nova'} Marmita Ju</h3>
            
            {/* AREA DE PREVIEW DA IMAGEM */}
            <div className="w-full aspect-square bg-gray-100 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center border-4 border-dashed border-gray-200">
               {editingProduct?.image ? (
                 <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400/FF7F11/FFFFFF?text=URL+INVALIDA'; }} />
               ) : (
                 <div className="text-center p-10 opacity-20 grayscale">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Cole a URL da foto abaixo</p>
                 </div>
               )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-4">
              <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DA MARMITA" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" required />
              <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL DA IMAGEM (LINK DA FOTO)" className="w-full bg-gray-100 border-2 border-[#FF7F11]/20 rounded-xl px-5 py-4 text-xs font-black outline-none focus:border-[#FF7F11]" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black outline-none" required />
                <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-[10px] font-black uppercase outline-none">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO / INGREDIENTES" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black h-20 resize-none outline-none focus:border-[#FF7F11]" />
              
              {/* RESTAURAÇÃO DA FUNÇÃO ATIVAR/DESATIVAR NO ESTOQUE */}
              <div className="flex items-center justify-between bg-gray-50 p-5 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase tracking-widest">Disponibilidade</span>
                   <span className="text-[9px] font-bold text-gray-400 uppercase">Item visível no cardápio</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setEditingProduct({...editingProduct, isAvailable: !editingProduct.isAvailable})}
                  className={`w-14 h-7 rounded-full relative transition-all duration-300 ${editingProduct?.isAvailable ? 'bg-[#6C7A1D]' : 'bg-red-400'}`}
                >
                   <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${editingProduct?.isAvailable ? 'left-8' : 'left-1'}`}></div>
                </button>
              </div>

              <button type="submit" className="w-full bg-black text-[#FF7F11] py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-[1.02] transition-all">Salvar Marmita</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CUPOM - SELEÇÃO DINÂMICA DE ESCOPO */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 relative shadow-2xl overflow-y-auto max-h-[90vh]">
             <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-xl md:text-2xl font-black italic mb-10 uppercase text-center">Novo Cupom Ju</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               if(!editingCoupon.code || !editingCoupon.percentage) return;
               await supabase.from('coupons').insert([{ code: editingCoupon.code.toUpperCase().trim(), percentage: editingCoupon.percentage, is_active: true, scope_type: editingCoupon.scopeType, scope_value: editingCoupon.scopeValue }]);
               setIsCouponModalOpen(false); fetchMarketing();
             }} className="space-y-6">
                <input placeholder="CÓDIGO (EX: JU10)" value={editingCoupon?.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-6 py-5 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" required />
                <input type="number" placeholder="% DESCONTO" value={editingCoupon?.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-xl px-6 py-5 text-xs font-black outline-none" required />
                <select value={editingCoupon?.scopeType} onChange={e => setEditingCoupon({...editingCoupon, scopeType: e.target.value as any, scopeValue: ''})} className="w-full bg-gray-50 border-2 rounded-xl px-6 py-4 text-xs font-black uppercase outline-none">
                  <option value="all">Todo o Cardápio</option>
                  <option value="category">Uma Categoria</option>
                  <option value="product">Um Produto</option>
                </select>
                {editingCoupon?.scopeType === 'category' && (
                  <select value={editingCoupon?.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-6 py-5 text-xs font-black uppercase outline-none" required>
                    <option value="">Selecione a Categoria...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                )}
                {editingCoupon?.scopeType === 'product' && (
                  <select value={editingCoupon?.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-6 py-5 text-xs font-black uppercase outline-none" required>
                    <option value="">Selecione o Produto...</option>
                    {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <button type="submit" className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs shadow-2xl">Ativar Cupom</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
