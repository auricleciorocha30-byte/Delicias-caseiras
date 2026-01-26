
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, LoyaltyUser, OrderStatus, StoreConfig, CartItem, OrderType } from '../types';
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
}

const STATUS_CFG: Record<string, any> = {
  'pending': { label: 'Pendente', badge: 'bg-orange-600 text-white animate-pulse' },
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
  
  // Modais State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);

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
    if (cData) setCoupons(cData.map(c => ({ id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, scopeType: c.scope_type, scopeValue: c.scope_value || '' })));
    const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
    if (lConfig) setLoyalty({ isActive: lConfig.is_active, spendingGoal: lConfig.spending_goal, scopeType: lConfig.scope_type || 'all', scopeValue: lConfig.scope_value || '' });
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) setLoyaltyUsers(lUsers);
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

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const itemsHtml = order.items.map(item => `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>${item.quantity}x ${item.name.toUpperCase()}</span><span>R$ ${(item.price * item.quantity).toFixed(2)}</span></div>`).join('');
    printWindow.document.write(`<html><head><title>Print</title><style>body{font-family:'Courier New',monospace;width:80mm;margin:0;padding:10mm;color:#000;background:#fff;}.center{text-align:center;}.bold{font-weight:bold;}.divider{border-top:1px dashed #000;margin:10px 0;}.total{font-size:20px;margin-top:10px;}</style></head><body onload="window.print();window.close();"><div class="center bold">${STORE_INFO.name.toUpperCase()}</div><div class="divider"></div><div class="bold">PEDIDO: #${order.id}</div><div>TIPO: ${order.orderType === 'delivery'?'ENTREGA':'RETIRADA'}</div><div class="divider"></div><div class="bold">CLIENTE: ${order.customerName.toUpperCase()}</div>${order.address?`<div>END: ${order.address.toUpperCase()}</div>`:''}<div class="divider"></div><div class="bold">ITENS:</div>${itemsHtml}<div class="divider"></div><div class="bold total">TOTAL: R$ ${order.finalTotal.toFixed(2)}</div><div class="divider"></div><div class="bold">PAGAMENTO: ${order.paymentMethod.toUpperCase()}</div></body></html>`);
    printWindow.document.close();
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className="bg-[#1A1A1A] p-6 rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-[#FF7F11]">
        <div className="flex items-center gap-4">
          <button onClick={onTestSound} className="bg-[#FF7F11] p-3 rounded-2xl shadow-lg hover:scale-110 transition-all"><VolumeIcon size={24} className="text-white"/></button>
          <div className="text-left">
            <h2 className="text-xl font-black italic text-white uppercase leading-none tracking-tighter">Ju Admin</h2>
            <p className="text-[9px] text-[#FF7F11] uppercase font-black tracking-[0.2em] mt-1">Gestão Marmitas</p>
          </div>
        </div>
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-[#FF7F11] text-white' : 'text-gray-500'}`}>{tab}</button>
          ))}
        </nav>
        <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl">Sair</button>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
               <h3 className="text-xl font-black uppercase italic">Fluxo de Pedidos</h3>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Pedido Local</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase italic text-[#FF7F11]">🚚 Delivery ({deliveryOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {deliveryOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#FF7F11]'}`}>
                      <div><h5 className="font-black text-lg uppercase">{t.currentOrder?.customerName}</h5></div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="font-black uppercase italic text-[#6C7A1D]">🏪 Retiradas ({takeawayOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {takeawayOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#6C7A1D]'}`}>
                      <div><h5 className="font-black text-lg uppercase">{t.currentOrder?.customerName}</h5></div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-black italic uppercase">Marmitas</h3>
              <div className="flex gap-4">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" />
                <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '' }); setIsProductModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Marmita</button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
              {filteredMenu.map(item => (
                <div key={item.id} className={`bg-gray-50 p-5 rounded-[3rem] border-2 relative group shadow-sm ${!item.isAvailable ? 'opacity-40 grayscale' : 'border-transparent hover:border-[#FF7F11]'}`}>
                  <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4" />
                  <h4 className="font-black text-[11px] uppercase truncate">{item.name}</h4>
                  <p className="text-[#FF7F11] font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 hover:bg-blue-100"><EditIcon size={18}/></button>
                    <button onClick={() => onSaveProduct({ ...item, isAvailable: !item.isAvailable })} className={`flex-1 p-3 rounded-xl shadow-sm ${item.isAvailable ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{item.isAvailable ? 'ON' : 'OFF'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESTAURAÇÃO DOS MODAIS NO JSX */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl">
              <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
              <h3 className="text-2xl font-black italic mb-10 uppercase text-center">Configurar Marmita</h3>
              <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
                <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-[#FF7F11]" required />
                <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none h-24 resize-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" required />
                  <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL IMAGEM" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black" />
                <div className="flex items-center gap-4 bg-gray-100 p-5 rounded-2xl">
                  <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6" />
                  <label className="text-[10px] font-black uppercase">Disponível no Site</label>
                </div>
                <button type="submit" className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Salvar Alterações</button>
              </form>
            </div>
          </div>
        )}

        {isManualOrderModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            <div className="bg-white w-full max-w-4xl rounded-[4rem] p-12 relative shadow-2xl flex flex-col md:flex-row gap-10 max-h-[90vh] overflow-hidden">
               <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
               <div className="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar pr-4">
                  <h3 className="text-2xl font-black italic uppercase">Pedido Local</h3>
                  <div className="space-y-4">
                    <input placeholder="NOME CLIENTE" value={manualOrderData.customerName} onChange={e => setManualOrderData({...manualOrderData, customerName: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setManualOrderData({...manualOrderData, type: 'delivery'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'delivery' ? 'bg-[#FF7F11] text-white border-[#FF7F11]' : 'bg-white'}`}>Entrega</button>
                      <button onClick={() => setManualOrderData({...manualOrderData, type: 'takeaway'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'takeaway' ? 'bg-[#6C7A1D] text-white border-[#6C7A1D]' : 'bg-white'}`}>Balcão</button>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-3xl border">
                    <h4 className="text-[10px] font-black uppercase mb-4 text-gray-400">Itens Selecionados</h4>
                    <div className="space-y-3">
                      {manualOrderData.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-xs font-black uppercase">
                          <span>{item.quantity}x {item.name}</span>
                          <button onClick={() => setManualOrderData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))} className="text-red-500"><TrashIcon size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={async () => {
                    const total = manualOrderData.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                    const range = manualOrderData.type === 'delivery' ? [900, 949] : [950, 999];
                    const tid = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free')?.id || range[0];
                    const newOrder: Order = { id: 'M'+Date.now().toString().slice(-4), customerName: manualOrderData.customerName, items: manualOrderData.items, total, finalTotal: total, paymentMethod: manualOrderData.paymentMethod, timestamp: new Date().toISOString(), tableId: tid, status: 'pending', orderType: manualOrderData.type === 'delivery' ? 'delivery' : 'counter' };
                    onUpdateTable(tid, 'occupied', newOrder);
                    setIsManualOrderModalOpen(false);
                    setManualOrderData({ customerName: '', customerPhone: '', address: '', items: [], type: 'delivery', paymentMethod: 'Pix' });
                  }} className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Finalizar Lançamento ✅</button>
               </div>
               <div className="flex-1 bg-gray-50 p-8 rounded-[3rem] overflow-y-auto no-scrollbar">
                  <h4 className="text-[11px] font-black uppercase text-gray-400 mb-6">Menu</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {menuItems.filter(i => i.isAvailable).map(prod => (
                      <button key={prod.id} onClick={() => setManualOrderData(prev => {
                        const existing = prev.items.find(i => i.id === prod.id);
                        if (existing) return { ...prev, items: prev.items.map(i => i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i) };
                        return { ...prev, items: [...prev.items, { ...prod, quantity: 1 }] };
                      })} className="bg-white p-4 rounded-3xl border-2 hover:border-[#FF7F11] text-left transition-all">
                         <p className="text-[10px] font-black uppercase truncate">{prod.name}</p>
                         <p className="text-[11px] font-black italic text-[#FF7F11]">R$ {prod.price.toFixed(2)}</p>
                      </button>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {isCouponModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl">
               <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
               <h3 className="text-2xl font-black italic mb-10 uppercase text-center">Novo Cupom</h3>
               <form onSubmit={async (e) => {
                 e.preventDefault();
                 await supabase.from('coupons').insert([{ code: editingCoupon.code.toUpperCase(), percentage: editingCoupon.percentage, is_active: true, scope_type: 'all' }]);
                 setIsCouponModalOpen(false);
                 fetchMarketing();
               }} className="space-y-6">
                  <input placeholder="CÓDIGO (EX: MARMITA10)" value={editingCoupon?.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black uppercase outline-none focus:border-[#FF7F11]" required />
                  <input type="number" placeholder="DESCONTO (%)" value={editingCoupon?.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black outline-none focus:border-[#FF7F11]" required />
                  <button type="submit" className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Ativar Cupom</button>
               </form>
            </div>
          </div>
        )}

        {selectedOrderId && selectedOrder && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
             <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 overflow-y-auto flex flex-col border-t-8 border-[#FF7F11]">
                <div className="flex justify-between items-start mb-8">
                   <div>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[#1A1A1A]">{selectedOrder.currentOrder?.customerName}</h3>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">#{selectedOrder.currentOrder?.id}</p>
                   </div>
                   <div className="flex gap-4">
                      <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-gray-900 text-white p-4 rounded-full hover:scale-105 transition-all"><PrinterIcon size={24}/></button>
                      <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
                   </div>
                </div>
                <div className="flex-1 space-y-8">
                   <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-4 ml-2">Status</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                            <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-[#1A1A1A]' : 'bg-white text-gray-400'}`}>
                               {STATUS_CFG[s].label}
                            </button>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 ml-2">Itens</h4>
                      {selectedOrder.currentOrder?.items.map((item, idx) => (
                         <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-gray-100">
                            <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" />
                            <div className="flex-1">
                               <p className="font-black text-sm uppercase text-[#1A1A1A]">{item.name}</p>
                               <p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
                <div className="pt-10 mt-10 border-t flex justify-between items-center">
                   <p className="text-4xl font-black italic text-[#1A1A1A]">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                   <button onClick={() => { if(confirm('Concluir?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-[#6C7A1D] text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px]">Finalizar ✅</button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
