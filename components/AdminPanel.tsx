
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, LoyaltyUser, OrderStatus, StoreConfig } from '../types';
import { CloseIcon, TrashIcon, VolumeIcon, PrinterIcon, EditIcon, BackupIcon, RestoreIcon } from './Icons';
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

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  tables = [], menuItems = [], categories = [], audioEnabled, onToggleAudio, onTestSound,
  onUpdateTable, onRefreshData, onLogout, onSaveProduct, onDeleteProduct, dbStatus, onAddToOrder,
  storeConfig, onUpdateStoreConfig
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'delivery' | 'menu' | 'marketing' | 'setup'>('tables');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  // MKT Data
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
    window.open(`${window.location.origin}${window.location.pathname}?view=menu`, '_blank');
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, scope_type: next.scopeType, scope_value: next.scopeValue });
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="bg-gray-800 p-6 rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-orange-500">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-3 rounded-2xl shadow-lg">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth="3" strokeLinecap="round"/></svg>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black italic text-white uppercase leading-none tracking-tighter">{STORE_INFO.name}</h2>
            <p className="text-[9px] text-orange-500 uppercase font-black tracking-[0.2em] mt-1">Painel Administrativo v2</p>
          </div>
        </div>

        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1">
          {(['tables', 'delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-orange-500 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'tables' ? 'Mesas' : tab === 'delivery' ? 'Externo' : tab === 'menu' ? 'Menu' : tab === 'marketing' ? 'Mkt' : 'Setup'}
            </button>
          ))}
        </nav>

        <div className="flex gap-4">
          <button onClick={handleOpenMenu} className="bg-green-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Ver meu cardápio 🥗</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="min-h-[60vh]">
        {activeTab === 'tables' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {tables.filter(t => t.id <= 12).map(t => (
              <button key={t.id} onClick={() => setSelectedTableId(t.id)} className={`h-48 p-6 rounded-[3rem] border-4 transition-all flex flex-col items-center justify-center gap-2 relative ${t.status === 'free' ? 'bg-white border-gray-100' : 'bg-orange-500 border-gray-800 shadow-2xl scale-105'}`}>
                <span className={`text-5xl font-black italic leading-none ${t.status === 'free' ? 'text-gray-800' : 'text-white'}`}>{t.id}</span>
                <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${t.status === 'free' ? 'bg-gray-100 text-gray-400' : 'bg-white text-orange-600'}`}>
                  {t.status === 'free' ? 'Livre' : 'Ocupada'}
                </span>
                {t.currentOrder && <span className="text-[10px] font-black text-white uppercase mt-2 truncate w-full px-4">{t.currentOrder.customerName}</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-orange-500">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Gerenciar Categorias</h3>
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:brightness-110 transition-all">+ Nova Categoria</button>
              </div>
              <div className="flex flex-wrap gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-gray-50 px-6 py-4 rounded-2xl border flex items-center gap-4 group">
                    <span className="font-black text-[11px] uppercase tracking-widest">{cat.name}</span>
                    <button onClick={async () => { if(confirm('Excluir categoria?')) { await supabase.from('categories').delete().eq('id', cat.id); onRefreshData(); } }} className="text-red-400 hover:text-red-600 transition-all"><TrashIcon size={18}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-gray-800">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Gerenciar Produtos</h3>
                <div className="flex gap-4 w-full md:w-auto">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="flex-1 md:w-64 bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-orange-500" />
                  <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true }); setIsProductModalOpen(true); }} className="bg-gray-800 text-orange-500 px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:brightness-125 transition-all">+ Novo Produto</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-gray-50 p-5 rounded-[3rem] border-2 border-transparent hover:border-orange-500 transition-all relative group overflow-hidden">
                    <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4 shadow-md" />
                    <h4 className="font-black text-[11px] uppercase truncate mb-1">{item.name}</h4>
                    <p className="text-orange-600 font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 flex justify-center"><EditIcon size={18}/></button>
                      <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-red-500 flex justify-center"><TrashIcon size={18}/></button>
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
                <h3 className="text-2xl font-black italic uppercase">💎 Ranking Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase transition-all ${loyalty.isActive ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                  {loyalty.isActive ? 'Ativado' : 'Desativado'}
                </button>
              </div>
              <div className="space-y-4 mb-10">
                <p className="text-[10px] font-black uppercase text-gray-400">Meta de Pontuação (R$)</p>
                <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 p-5 rounded-2xl font-black text-xl outline-none focus:border-green-600 transition-all" />
              </div>
              <div className="space-y-3">
                {loyaltyUsers.slice(0, 10).map((user, i) => (
                  <div key={user.phone} className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border">
                    <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤'}</span>
                    <div className="flex-1">
                      <p className="font-black text-[12px] uppercase">{user.name || 'Sem Nome'}</p>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${Math.min(100, (user.accumulated / loyalty.spendingGoal) * 100)}%` }}></div>
                      </div>
                    </div>
                    <span className="font-black italic text-green-700 text-sm">R$ {user.accumulated.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-orange-500">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black italic uppercase">🎫 Cupons Ativos</h3>
                  <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-gray-800 text-orange-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
               </div>
               <div className="space-y-4">
                  {coupons.map(coupon => (
                    <div key={coupon.id} className="p-6 bg-gray-50 rounded-[2.5rem] border-2 border-gray-100 flex justify-between items-center">
                      <div>
                        <span className="bg-gray-800 text-orange-500 px-4 py-1.5 rounded-lg font-black tracking-[0.2em] text-sm uppercase">{coupon.code}</span>
                        <p className="text-green-600 font-black text-[12px] mt-2 uppercase">{coupon.percentage}% DE DESCONTO</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={async () => { await supabase.from('coupons').delete().eq('id', coupon.id); fetchMarketing(); }} className="p-4 bg-white rounded-2xl text-red-500 shadow-sm border border-transparent hover:border-red-100 transition-all"><TrashIcon size={20}/></button>
                      </div>
                    </div>
                  ))}
                  {coupons.length === 0 && <div className="text-center py-20 text-gray-300 font-black uppercase text-[10px] tracking-widest">Nenhum cupom ativo</div>}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-gray-800 text-center">
            <h3 className="text-2xl font-black italic uppercase mb-10">Configurações Gerais</h3>
            <div className="grid grid-cols-1 gap-4 mb-10">
               {[
                 { id: 'tablesEnabled', label: 'Atendimento em Mesas', icon: '🪑' },
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
                      className={`w-16 h-8 rounded-full relative transition-all ${storeConfig[service.id as keyof StoreConfig] ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${storeConfig[service.id as keyof StoreConfig] ? 'left-9' : 'left-1'}`}></div>
                    </button>
                 </div>
               ))}
            </div>
            <button className="w-full bg-gray-800 text-orange-500 py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3">
              <BackupIcon size={20}/> Fazer Backup de Dados (.json)
            </button>
          </div>
        )}
      </div>

      {/* Modais */}
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
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="NOME DA CATEGORIA" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black uppercase outline-none focus:border-orange-500" required />
                <button type="submit" className="w-full bg-orange-500 text-white py-6 rounded-2xl font-black uppercase text-xs shadow-xl">Criar Agora</button>
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
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-gray-400 ml-2">Nome do Prato</p>
                  <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-orange-500" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-gray-400 ml-2">Preço R$</p>
                    <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-orange-500" required />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-gray-400 ml-2">Categoria</p>
                    <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-orange-500">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-gray-400 ml-2">URL da Imagem</p>
                  <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-orange-500" />
                </div>
                <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl">
                   <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6 rounded-lg accent-orange-500" />
                   <label className="text-[10px] font-black uppercase text-gray-700">Disponível no Cardápio</label>
                </div>
                <button type="submit" className="w-full bg-gray-800 text-orange-500 py-6 rounded-3xl font-black uppercase text-xs shadow-2xl mt-4">Salvar Alterações</button>
             </form>
          </div>
        </div>
      )}

      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 relative shadow-2xl">
             <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-10 uppercase text-center">Configurar Cupom</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               await supabase.from('coupons').insert([{ code: editingCoupon.code.toUpperCase(), percentage: editingCoupon.percentage, is_active: true, scope_type: 'all' }]);
               setIsCouponModalOpen(false);
               fetchMarketing();
             }} className="space-y-6">
                <input placeholder="CÓDIGO (EX: SAUDE10)" value={editingCoupon?.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black uppercase outline-none focus:border-orange-500" required />
                <input type="number" placeholder="PORCENTAGEM (%)" value={editingCoupon?.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black outline-none focus:border-orange-500" required />
                <button type="submit" className="w-full bg-gray-800 text-orange-500 py-6 rounded-2xl font-black uppercase text-xs shadow-xl">Ativar Cupom</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
