
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, LoyaltyUser, OrderStatus, StoreConfig } from '../types';
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
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

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
    if (lConfig) setLoyalty({ isActive: lConfig.is_active, spendingGoal: lConfig.spending_goal, scopeType: lConfig.scope_type, scopeValue: lConfig.scope_value || '' });
    
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) setLoyaltyUsers(lUsers);
  };

  const handleOpenMenu = () => {
    // Garante que o link abra com o parâmetro view=menu
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'menu');
    window.open(url.toString(), '_blank');
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, scope_type: next.scopeType, scope_value: next.scopeValue });
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeOrders = tables.filter(t => t.id >= 900 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className="bg-brand-dark p-6 rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-brand-orange">
        <div className="flex items-center gap-4">
          <div className="bg-brand-orange p-3 rounded-2xl shadow-lg">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth="3" strokeLinecap="round"/></svg>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black italic text-white uppercase leading-none tracking-tighter">{STORE_INFO.name}</h2>
            <p className="text-[9px] text-brand-orange uppercase font-black tracking-[0.2em] mt-1">Gestão D.Moreira</p>
          </div>
        </div>

        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-brand-orange text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Cardápio' : tab === 'marketing' ? 'Mkt' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="flex gap-4">
          <button onClick={handleOpenMenu} className="bg-brand-green text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Ver meu cardápio 🥗</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'delivery' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeOrders.map(t => (
              <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="bg-white p-6 rounded-[3rem] border-4 border-brand-orange text-left relative overflow-hidden group shadow-xl transition-all hover:scale-[1.02]">
                <div className="absolute top-0 right-0 px-4 py-2 text-[9px] font-black uppercase bg-brand-orange text-white">
                  {t.id >= 950 ? 'Balcão' : 'Entrega'}
                </div>
                <h4 className="font-black text-lg uppercase truncate mb-1 text-brand-dark">{t.currentOrder?.customerName}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-widest">Pedido #{t.currentOrder?.id}</p>
                <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[9px] font-black px-4 py-1.5 rounded-full inline-block uppercase tracking-widest`}>
                  {STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                </div>
              </button>
            ))}
            {activeOrders.length === 0 && (
              <div className="col-span-full py-20 text-center opacity-20 grayscale">
                <p className="font-black uppercase text-xl tracking-widest">Nenhum pedido ativo no momento</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-orange">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Categorias</h3>
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-brand-orange text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Categoria</button>
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

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-dark">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Produtos</h3>
                <div className="flex gap-4 w-full md:w-auto">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="flex-1 md:w-64 bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-brand-orange" />
                  <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true }); setIsProductModalOpen(true); }} className="bg-brand-dark text-brand-orange px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:brightness-125 transition-all">+ Novo Produto</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-gray-50 p-5 rounded-[3rem] border-2 border-transparent hover:border-brand-orange transition-all relative group overflow-hidden shadow-sm">
                    <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4 shadow-md" />
                    <h4 className="font-black text-[11px] uppercase truncate mb-1">{item.name}</h4>
                    <p className="text-brand-orange font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 flex justify-center hover:bg-blue-50 transition-colors"><EditIcon size={18}/></button>
                      <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-red-500 flex justify-center hover:bg-red-50 transition-colors"><TrashIcon size={18}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-green">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">💎 Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase transition-all ${loyalty.isActive ? 'bg-brand-green text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                  {loyalty.isActive ? 'Ativado' : 'Desativado'}
                </button>
              </div>
              <div className="space-y-4 mb-10">
                <p className="text-[10px] font-black uppercase text-gray-400">Meta R$</p>
                <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 p-5 rounded-2xl font-black text-xl outline-none focus:border-brand-green transition-all" />
              </div>
              <div className="space-y-3">
                {loyaltyUsers.slice(0, 10).map((user, i) => (
                  <div key={user.phone} className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border">
                    <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤'}</span>
                    <div className="flex-1">
                      <p className="font-black text-[12px] uppercase">{user.name || 'Sem Nome'}</p>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-brand-green" style={{ width: `${Math.min(100, (user.accumulated / loyalty.spendingGoal) * 100)}%` }}></div>
                      </div>
                    </div>
                    <span className="font-black italic text-brand-green text-sm">R$ {user.accumulated.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-orange">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black italic uppercase">🎫 Cupons</h3>
                  <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-brand-dark text-brand-orange px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
               </div>
               <div className="space-y-4">
                  {coupons.map(coupon => (
                    <div key={coupon.id} className="p-6 bg-gray-50 rounded-[2.5rem] border-2 border-gray-100 flex justify-between items-center">
                      <div>
                        <span className="bg-brand-dark text-brand-orange px-4 py-1.5 rounded-lg font-black tracking-[0.2em] text-sm uppercase">{coupon.code}</span>
                        <p className="text-brand-green font-black text-[12px] mt-2 uppercase">{coupon.percentage}% OFF</p>
                      </div>
                      <button onClick={async () => { if(confirm('Excluir?')) { await supabase.from('coupons').delete().eq('id', coupon.id); fetchMarketing(); } }} className="p-4 bg-white rounded-2xl text-red-500 shadow-sm border border-transparent hover:border-red-100 transition-all"><TrashIcon size={20}/></button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-dark text-center">
            <h3 className="text-2xl font-black italic uppercase mb-10">Loja Aberta/Fechada</h3>
            <div className="grid grid-cols-1 gap-4 mb-10 text-left">
               {[
                 { id: 'deliveryEnabled', label: 'Pedidos p/ Entrega', icon: '🚚' },
                 { id: 'counterEnabled', label: 'Retirada no Balcão', icon: '🏪' }
               ].map(service => (
                 <div key={service.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{service.icon}</span>
                      <span className="font-black uppercase text-[11px] tracking-widest">{service.label}</span>
                    </div>
                    <button 
                      onClick={() => onUpdateStoreConfig({ ...storeConfig, [service.id]: !storeConfig[service.id as keyof StoreConfig] })}
                      className={`w-16 h-8 rounded-full relative transition-all ${storeConfig[service.id as keyof StoreConfig] ? 'bg-brand-green' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${storeConfig[service.id as keyof StoreConfig] ? 'left-9' : 'left-1'}`}></div>
                    </button>
                 </div>
               ))}
            </div>
            <div className="p-6 bg-orange-50 border-2 border-brand-orange/20 rounded-[2.5rem] mb-10">
              <p className="text-[10px] font-black uppercase text-brand-orange mb-2 tracking-widest">Aviso importante</p>
              <p className="text-[11px] font-bold text-gray-600 leading-relaxed uppercase">Ao desativar ambos os serviços, o cardápio público exibirá uma mensagem de "Loja Fechada" para os clientes.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modais de Gerenciamento */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 relative shadow-2xl">
             <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-8 uppercase text-center">Nova Categoria</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               if (!newCategoryName) return;
               await supabase.from('categories').insert([{ name: newCategoryName }]);
               setNewCategoryName('');
               setIsCategoryModalOpen(false);
               onRefreshData();
             }} className="space-y-6">
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="NOME" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black uppercase outline-none focus:border-brand-orange" required />
                <button type="submit" className="w-full bg-brand-orange text-white py-6 rounded-2xl font-black uppercase text-xs shadow-xl">Criar</button>
             </form>
          </div>
        </div>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
             <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-10 uppercase text-center">{editingProduct?.id ? 'Editar' : 'Novo'} Produto</h3>
             <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
                <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DO PRODUTO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-brand-orange" required />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none" required />
                  <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL DA IMAGEM" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none" />
                <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl">
                   <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6 rounded-lg accent-brand-orange" />
                   <label className="text-[10px] font-black uppercase">Disponível</label>
                </div>
                <button type="submit" className="w-full bg-brand-dark text-brand-orange py-6 rounded-3xl font-black uppercase text-xs shadow-2xl">Salvar</button>
             </form>
          </div>
        </div>
      )}

      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
           <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 overflow-y-auto flex flex-col border-t-8 border-brand-orange">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-brand-dark">Pedido de {selectedOrder.currentOrder?.customerName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">ID: #{selectedOrder.currentOrder?.id} • {selectedOrder.id >= 950 ? 'Retirada Balcão' : 'Entrega'}</p>
                 </div>
                 <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={24}/></button>
              </div>

              <div className="flex-1 space-y-8">
                 <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-brand-orange text-white border-brand-dark shadow-lg' : 'bg-white text-gray-400 border-transparent hover:border-gray-200'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Itens Solicitados</h4>
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-gray-100">
                          <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" />
                          <div className="flex-1">
                             <p className="font-black text-sm uppercase text-brand-dark">{item.name}</p>
                             <p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                          </div>
                          <span className="font-black italic text-brand-orange">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>

                 {selectedOrder.currentOrder?.address && (
                    <div className="bg-brand-dark text-white p-8 rounded-[2.5rem]">
                       <p className="text-[9px] font-black uppercase text-brand-orange tracking-widest mb-2">Endereço de Entrega</p>
                       <p className="text-sm font-bold uppercase">{selectedOrder.currentOrder.address}</p>
                    </div>
                 )}
              </div>

              <div className="pt-10 mt-10 border-t flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Final</p>
                    <p className="text-4xl font-black italic text-brand-dark">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                 </div>
                 <button onClick={() => { if(confirm('Finalizar e remover da lista?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-brand-green text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Concluir Pedido ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
