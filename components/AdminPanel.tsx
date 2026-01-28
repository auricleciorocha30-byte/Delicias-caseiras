
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
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({ code: '', percentage: 0, isActive: true, scopeType: 'all', scopeValue: '' });
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Marketing States
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([]);

  useEffect(() => {
    if (activeTab === 'marketing') fetchMarketing();
  }, [activeTab]);

  const fetchMarketing = async () => {
    const { data: cData } = await supabase.from('coupons').select('*');
    if (cData) setCoupons(cData.map(c => ({ 
      id: c.id, 
      code: c.code, 
      percentage: c.percentage, 
      isActive: c.is_active, 
      scopeType: c.scope_type as any, 
      scopeValue: c.scope_value || '' 
    })));
    
    const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
    if (lConfig) setLoyalty({ 
      isActive: lConfig.is_active, 
      spendingGoal: Number(lConfig.spending_goal), 
      scopeType: lConfig.scope_type as any, 
      scopeValue: lConfig.scope_value || '' 
    });
    
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) setLoyaltyUsers(lUsers.map(u => ({ phone: u.phone, name: u.name, accumulated: Number(u.accumulated) })));
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ 
      id: 1, 
      is_active: next.isActive, 
      spending_goal: next.spendingGoal, 
      scope_type: next.scopeType, 
      scope_value: next.scopeValue 
    });
  };

  const handleSaveCoupon = async () => {
    if (!editingCoupon.code) return;
    const { error } = await supabase.from('coupons').upsert({
      id: editingCoupon.id || undefined,
      code: editingCoupon.code.toUpperCase(),
      percentage: editingCoupon.percentage,
      is_active: editingCoupon.isActive,
      scope_type: editingCoupon.scopeType,
      scope_value: editingCoupon.scopeValue
    });
    if (!error) {
      setIsCouponModalOpen(false);
      fetchMarketing();
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (confirm('Excluir este cupom?')) {
      await supabase.from('coupons').delete().eq('id', id);
      fetchMarketing();
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('categories').insert([{ name: newCatName.trim() }]);
    if (error) alert('Erro ao adicionar categoria ou nome já existe.');
    else { setNewCatName(''); onRefreshData(); }
  };

  const handleDeleteCategory = async (name: string) => {
    if (confirm(`Excluir a categoria "${name}"? Produtos vinculados podem parar de aparecer corretamente.`)) {
      await supabase.from('categories').delete().eq('name', name);
      onRefreshData();
    }
  };

  const handleCreateManualOrder = async () => {
    if (!manualCustomer.name || manualOrderItems.length === 0) return alert('Preencha o nome e adicione itens.');
    
    const subtotal = manualOrderItems.reduce((a, b) => a + (b.price * b.quantity), 0);
    const range = manualCustomer.type === 'delivery' ? [900, 949] : [950, 999];
    const freeTable = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free');
    const tableId = freeTable?.id || range[0];

    const newOrder: Order = {
      id: 'MANUAL-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      customerName: manualCustomer.name,
      customerPhone: manualCustomer.phone,
      items: manualOrderItems,
      total: subtotal,
      finalTotal: subtotal,
      paymentMethod: 'Pix',
      timestamp: new Date().toISOString(),
      tableId: tableId,
      orderType: manualCustomer.type === 'delivery' ? 'delivery' : 'counter',
      address: manualCustomer.address,
      status: 'pending'
    };

    onUpdateTable(tableId, 'occupied', newOrder);
    setManualOrderItems([]);
    setManualCustomer({ name: '', phone: '', address: '', type: 'delivery' });
    setIsManualOrderModalOpen(false);
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const itemsHtml = order.items.map(item => `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-weight:bold;">
        <span>${item.quantity}x ${item.name.toUpperCase()}</span>
        <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');
    
    printWindow.document.write(`
      <html>
        <head><style>body { font-family: 'Courier New', monospace; width: 80mm; padding: 5mm; }</style></head>
        <body onload="window.print();window.close();">
          <div style="text-align:center;font-weight:bold;">${STORE_INFO.name.toUpperCase()}</div>
          <hr/>
          <div>PEDIDO: #${order.id}</div>
          <div>CLIENTE: ${order.customerName}</div>
          <hr/>
          ${itemsHtml}
          <hr/>
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.2em;">
            <span>TOTAL:</span><span>R$ ${order.finalTotal.toFixed(2)}</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Pedido Manual State
  const [manualOrderItems, setManualOrderItems] = useState<CartItem[]>([]);
  const [manualCustomer, setManualCustomer] = useState({ name: '', phone: '', address: '', type: 'delivery' as any });

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
            <span className="bg-[#1A1A1A] px-4 py-2 rounded-2xl text-[10px] font-black uppercase">OK</span>
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
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-4 py-3 rounded-xl md:hidden">Sair</button>
        </div>
        
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-[#FF7F11] text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Produtos' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex gap-2">
          <button onClick={() => window.open(window.location.origin + '?view=menu', '_blank')} className="bg-[#6C7A1D] text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2">Ver Cardápio</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA AJUSTES */}
        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <h3 className="text-xl md:text-2xl font-black italic uppercase mb-10 text-center">Ajustes do Cardápio</h3>
            <div className="space-y-6">
               <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border-2 border-dashed">
                  <div><p className="font-black text-[11px] uppercase">Delivery Ativo</p><p className="text-[9px] text-gray-400">Aceitar pedidos para entrega</p></div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, deliveryEnabled: !storeConfig.deliveryEnabled})} className={`w-14 h-7 rounded-full relative transition-all ${storeConfig.deliveryEnabled ? 'bg-[#6C7A1D]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${storeConfig.deliveryEnabled ? 'left-8' : 'left-1'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border-2 border-dashed">
                  <div><p className="font-black text-[11px] uppercase">Retirada Ativa</p><p className="text-[9px] text-gray-400">Aceitar pedidos para retirada</p></div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, counterEnabled: !storeConfig.counterEnabled})} className={`w-14 h-7 rounded-full relative transition-all ${storeConfig.counterEnabled ? 'bg-[#6C7A1D]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${storeConfig.counterEnabled ? 'left-8' : 'left-1'}`}></div>
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* ABA PRODUTOS */}
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
                <div key={item.id} className={`bg-gray-50 p-3 md:p-5 rounded-[2rem] border-2 relative ${!item.isAvailable ? 'opacity-50 grayscale' : 'border-transparent'}`}>
                  <div className="w-full aspect-square bg-gray-200 rounded-2xl mb-3 overflow-hidden">
                    <img src={item.image} onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400/FF7F11/FFFFFF?text=' + item.name.charAt(0); }} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="font-black text-[10px] uppercase truncate">{item.name}</h4>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-2 rounded-xl text-blue-500 flex justify-center shadow-sm"><EditIcon size={16}/></button>
                    <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-2 rounded-xl text-red-500 flex justify-center shadow-sm"><TrashIcon size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA MARKETING - RESTAURADA COMPLETAMENTE */}
        {activeTab === 'marketing' && (
          <div className="space-y-10">
            {/* CONFIGURAÇÃO DE FIDELIDADE */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-[#6C7A1D]">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">Programa de Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`w-16 h-8 rounded-full relative transition-all ${loyalty.isActive ? 'bg-[#6C7A1D]' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${loyalty.isActive ? 'left-9' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 opacity-90">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Meta de Gasto (R$)</p>
                  <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-[#6C7A1D]" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Abrangência</p>
                  <select value={loyalty.scopeType} onChange={e => handleUpdateLoyalty({ scopeType: e.target.value as any, scopeValue: '' })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#6C7A1D]">
                    <option value="all">Toda a Loja</option>
                    <option value="category">Por Categoria</option>
                    <option value="product">Por Produto</option>
                  </select>
                </div>
                {loyalty.scopeType !== 'all' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Valor do Escopo</p>
                    {loyalty.scopeType === 'category' ? (
                      <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#6C7A1D]">
                        <option value="">Selecione...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : (
                      <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#6C7A1D]">
                        <option value="">Selecione...</option>
                        {menuItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* GESTÃO DE CUPONS */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-[#FF7F11]">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">Cupons de Desconto</h3>
                <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(c => (
                  <div key={c.id} className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed flex flex-col relative overflow-hidden">
                    <div className={`absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase ${c.isActive ? 'bg-[#6C7A1D] text-white' : 'bg-red-500 text-white'}`}>
                      {c.isActive ? 'Ativo' : 'Inativo'}
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-black italic text-[#FF7F11]">{c.code}</h4>
                        <p className="text-[10px] font-black text-gray-400 uppercase">{c.percentage}% DE DESCONTO</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingCoupon(c); setIsCouponModalOpen(true); }} className="p-2 bg-white rounded-xl shadow-sm text-blue-500"><EditIcon size={16}/></button>
                        <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 bg-white rounded-xl shadow-sm text-red-500"><TrashIcon size={16}/></button>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-dashed">
                      <p className="text-[9px] font-black uppercase text-gray-500">
                        {c.scopeType === 'all' ? '✨ Toda a Loja' : c.scopeType === 'category' ? `📁 Categoria: ${c.scopeValue}` : `🥘 Produto: ${menuItems.find(i => i.id === c.scopeValue)?.name || 'Removido'}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CLIENTES FIDELIZADOS */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-[#1A1A1A]">
              <h3 className="text-2xl font-black italic uppercase mb-10">Ranking de Clientes (Gasto Acumulado)</h3>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead className="border-b-2">
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      <th className="pb-4">Cliente</th>
                      <th className="pb-4">WhatsApp</th>
                      <th className="pb-4">Acumulado</th>
                      <th className="pb-4">Progressão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loyaltyUsers.map(user => (
                      <tr key={user.phone} className="text-[11px] font-bold">
                        <td className="py-5 uppercase">{user.name}</td>
                        <td className="py-5">{user.phone}</td>
                        <td className="py-5 text-[#FF7F11] font-black">R$ {user.accumulated.toFixed(2)}</td>
                        <td className="py-5">
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#6C7A1D]" style={{ width: `${Math.min(100, (user.accumulated / loyalty.spendingGoal) * 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loyaltyUsers.length === 0 && <p className="text-center py-10 text-gray-400 uppercase text-[10px] font-black">Nenhum cliente no programa ainda.</p>}
              </div>
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

      {/* MODAL CATEGORIAS */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 relative">
            <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
            <h3 className="text-xl font-black uppercase italic mb-8">Gerenciar Categorias</h3>
            <div className="flex gap-2 mb-6">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nova Categoria..." className="flex-1 bg-gray-50 border-2 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-[#FF7F11]"/>
              <button onClick={handleAddCategory} className="bg-black text-[#FF7F11] px-4 py-3 rounded-xl font-black text-[10px] uppercase">Add</button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
              {categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border">
                  <span className="text-xs font-black uppercase">{cat.name}</span>
                  <button onClick={() => handleDeleteCategory(cat.name)} className="text-red-500"><TrashIcon size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CUPOM - NOVO */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 relative overflow-y-auto max-h-[90vh] no-scrollbar">
            <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
            <h3 className="text-2xl font-black italic mb-8 uppercase text-center">Configurar Cupom</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Código do Cupom</p>
                <input value={editingCoupon.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} placeholder="EX: VERAO20" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Desconto (%)</p>
                  <input type="number" value={editingCoupon.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-[#FF7F11]" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Status</p>
                  <button onClick={() => setEditingCoupon({...editingCoupon, isActive: !editingCoupon.isActive})} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${editingCoupon.isActive ? 'bg-[#6C7A1D] text-white border-[#6C7A1D]' : 'bg-red-100 text-red-500 border-red-200'}`}>
                    {editingCoupon.isActive ? 'Ativado' : 'Desativado'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Onde aplicar?</p>
                <select value={editingCoupon.scopeType} onChange={e => setEditingCoupon({...editingCoupon, scopeType: e.target.value as any, scopeValue: ''})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#FF7F11]">
                  <option value="all">Toda a Loja</option>
                  <option value="category">Uma Categoria</option>
                  <option value="product">Um Produto Específico</option>
                </select>
              </div>

              {editingCoupon.scopeType !== 'all' && (
                <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Selecione o Item</p>
                  {editingCoupon.scopeType === 'category' ? (
                    <select value={editingCoupon.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#FF7F11]">
                      <option value="">Selecione...</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <select value={editingCoupon.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none focus:border-[#FF7F11]">
                      <option value="">Selecione...</option>
                      {menuItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              <button onClick={handleSaveCoupon} className="w-full bg-black text-[#FF7F11] py-5 rounded-2xl font-black uppercase text-xs shadow-2xl mt-4">Salvar Cupom</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIDO MANUAL */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3rem] p-8 md:p-12 relative flex flex-col">
            <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
            <h3 className="text-2xl font-black uppercase italic mb-10">Lançar Novo Pedido</h3>
            
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-hidden">
               <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar pr-2">
                  <p className="text-[10px] font-black uppercase text-gray-400">Escolha os Itens</p>
                  <div className="grid grid-cols-1 gap-2">
                     {menuItems.map(item => (
                        <button key={item.id} onClick={() => {
                           const ex = manualOrderItems.find(i => i.id === item.id);
                           if(ex) setManualOrderItems(manualOrderItems.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
                           else setManualOrderItems([...manualOrderItems, {...item, quantity: 1}]);
                        }} className="flex items-center gap-4 bg-gray-50 p-3 rounded-2xl border hover:border-[#FF7F11] transition-all text-left">
                           <img src={item.image} className="w-12 h-12 rounded-xl object-cover" onError={(e)=>e.currentTarget.src='https://placehold.co/100x100?text=Food'}/>
                           <div className="flex-1">
                              <p className="text-[11px] font-black uppercase leading-tight">{item.name}</p>
                              <p className="text-[10px] font-bold text-[#FF7F11]">R$ {item.price.toFixed(2)}</p>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex flex-col gap-6 bg-gray-50 p-6 rounded-[2.5rem] border border-dashed">
                  <div className="space-y-3">
                    <input value={manualCustomer.name} onChange={e => setManualCustomer({...manualCustomer, name: e.target.value})} placeholder="NOME DO CLIENTE" className="w-full bg-white border-2 rounded-xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" />
                    <input value={manualCustomer.phone} onChange={e => setManualCustomer({...manualCustomer, phone: e.target.value})} placeholder="TELEFONE" className="w-full bg-white border-2 rounded-xl px-5 py-4 text-xs font-black outline-none" />
                    <div className="flex gap-2">
                       <button onClick={() => setManualCustomer({...manualCustomer, type: 'delivery'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${manualCustomer.type === 'delivery' ? 'bg-[#FF7F11] text-white border-[#FF7F11]' : 'bg-white'}`}>Entrega</button>
                       <button onClick={() => setManualCustomer({...manualCustomer, type: 'counter'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${manualCustomer.type === 'counter' ? 'bg-[#6C7A1D] text-white border-[#6C7A1D]' : 'bg-white'}`}>Balcão</button>
                    </div>
                    {manualCustomer.type === 'delivery' && <textarea value={manualCustomer.address} onChange={e => setManualCustomer({...manualCustomer, address: e.target.value})} placeholder="ENDEREÇO COMPLETO..." className="w-full bg-white border-2 rounded-xl px-5 py-4 text-xs font-black h-20 resize-none outline-none"/>}
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 border-t pt-4">
                     {manualOrderItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-[10px] font-black uppercase">
                           <span>{item.quantity}x {item.name}</span>
                           <div className="flex items-center gap-2">
                              <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                              <button onClick={() => setManualOrderItems(manualOrderItems.filter(i => i.id !== item.id))} className="text-red-500">×</button>
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="border-t pt-4">
                     <div className="flex justify-between items-end mb-4">
                        <span className="text-[10px] font-black uppercase">Total</span>
                        <span className="text-3xl font-black italic">R$ {manualOrderItems.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</span>
                     </div>
                     <button onClick={handleCreateManualOrder} className="w-full bg-black text-[#FF7F11] py-5 rounded-2xl font-black uppercase text-xs shadow-xl">Finalizar e Lançar</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
            <h3 className="text-xl md:text-2xl font-black italic mb-8 uppercase text-center">{editingProduct?.id ? 'Editar' : 'Nova'} Marmita Ju</h3>
            
            <div className="w-full aspect-square bg-gray-100 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center border-4 border-dashed border-gray-200">
               {editingProduct?.image && editingProduct.image.length > 5 ? (
                 <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400/FF7F11/FFFFFF?text=SEM+IMAGEM'; }} />
               ) : (
                 <div className="text-center p-10 opacity-30">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Cole o link da foto abaixo</p>
                 </div>
               )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-4">
              <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DA MARMITA" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" required />
              <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL DA IMAGEM (LINK)" className="w-full bg-gray-100 border-2 border-[#FF7F11]/20 rounded-xl px-5 py-4 text-xs font-black outline-none focus:border-[#FF7F11]" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black outline-none" required />
                <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-[10px] font-black uppercase outline-none">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO / INGREDIENTES" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black h-20 resize-none outline-none focus:border-[#FF7F11]" />
              <div className="flex items-center justify-between bg-gray-50 p-5 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest">Disponibilidade</span><span className="text-[9px] font-bold text-gray-400 uppercase">Item em estoque</span></div>
                <button type="button" onClick={() => setEditingProduct({...editingProduct, isAvailable: !editingProduct.isAvailable})} className={`w-14 h-7 rounded-full relative transition-all duration-300 ${editingProduct?.isAvailable ? 'bg-[#6C7A1D]' : 'bg-red-400'}`}>
                   <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${editingProduct?.isAvailable ? 'left-8' : 'left-1'}`}></div>
                </button>
              </div>
              <button type="submit" className="w-full bg-black text-[#FF7F11] py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-[1.02] transition-all">Salvar Marmita</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES PEDIDO */}
      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
           <div className="relative bg-white w-full max-w-2xl h-[80vh] rounded-[2.5rem] p-6 md:p-10 overflow-y-auto flex flex-col border-t-8 border-[#FF7F11]">
              <div className="flex justify-between items-start mb-6">
                 <div><h3 className="text-2xl md:text-3xl font-black uppercase italic">{selectedOrder.currentOrder?.customerName}</h3><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">#{selectedOrder.currentOrder?.id}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-black text-[#FF7F11] p-3 rounded-full"><PrinterIcon size={20}/></button>
                    <button onClick={() => setSelectedOrderId(null)} className="p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
                 </div>
              </div>
              <div className="flex-1 space-y-6">
                 <div className="bg-gray-50 p-6 rounded-2xl border">
                    <p className="text-[8px] font-black text-gray-400 mb-4 uppercase">Status do Pedido</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-3 rounded-xl text-[8px] font-black uppercase border-2 ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-black' : 'bg-white'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-3">
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-3 bg-white p-4 rounded-xl border">
                          <img src={item.image} onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100?text=Food'; }} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1"><p className="font-black text-[10px] uppercase">{item.name}</p><p className="text-[9px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p></div>
                          <span className="font-black italic text-[#FF7F11] text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="pt-6 mt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="text-center md:text-left"><p className="text-[9px] text-gray-400 uppercase font-black">Total</p><p className="text-3xl font-black italic">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p></div>
                 <button onClick={() => { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); }} className="w-full md:w-auto bg-[#6C7A1D] text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px]">Concluir Pedido ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
