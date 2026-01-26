
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
  
  // Modais States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);

  // Marketing States
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });

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
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, scope_type: next.scopeType, scope_value: next.scopeValue });
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const itemsHtml = order.items.map(item => `<div style="display:flex;justify-content:space-between;font-weight:bold;margin-bottom:2px;"><span>${item.quantity}x ${item.name.toUpperCase()}</span><span>R$ ${(item.price * item.quantity).toFixed(2)}</span></div>`).join('');
    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 5mm; color: #000; background: #fff; line-height: 1.2; font-size: 13px; }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .divider { border-top: 2px dashed #000; margin: 8px 0; }
            .total { font-size: 18px; margin-top: 5px; border-top: 2px solid #000; padding-top: 5px; }
            .header { font-size: 16px; margin-bottom: 5px; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="center bold header">${STORE_INFO.name.toUpperCase()}</div>
          <div class="center bold">${STORE_INFO.slogan}</div>
          <div class="divider"></div>
          <div class="bold">PEDIDO: #${order.id}</div>
          <div>DATA: ${new Date().toLocaleString('pt-BR')}</div>
          <div>TIPO: ${order.orderType === 'delivery' ? 'ENTREGA' : 'RETIRADA'}</div>
          <div class="divider"></div>
          <div class="bold">CLIENTE: ${order.customerName.toUpperCase()}</div>
          ${order.address ? `<div class="bold">END: ${order.address.toUpperCase()}</div>` : ''}
          <div class="divider"></div>
          <div class="bold">ITENS:</div>
          ${itemsHtml}
          <div class="total bold" style="display:flex;justify-content:space-between;">
            <span>VALOR TOTAL:</span>
            <span>R$ ${order.finalTotal.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="bold">PAGAMENTO: ${order.paymentMethod.toUpperCase()}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top:15px;">JU MARMITAS CASEIRAS</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* HEADER ADMIN */}
      <div className="bg-[#1A1A1A] p-6 rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-[#FF7F11]">
        <div className="flex items-center gap-4">
          <button onClick={onTestSound} className="bg-[#FF7F11] p-3 rounded-2xl shadow-lg hover:scale-110 transition-all">
            <VolumeIcon size={24} className="text-white"/>
          </button>
          <div className="text-left">
            <h2 className="text-xl font-black italic text-white uppercase leading-none tracking-tighter">Ju Admin</h2>
            <p className="text-[9px] text-[#FF7F11] uppercase font-black tracking-[0.2em] mt-1">Gestão Marmitas</p>
          </div>
        </div>
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-[#FF7F11] text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Marmitas' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA MARKETING */}
        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#6C7A1D]">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">💎 Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`px-6 py-3 rounded-2xl font-black text-[9px] uppercase transition-all ${loyalty.isActive ? 'bg-[#6C7A1D] text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                  {loyalty.isActive ? 'Ativo' : 'Inativo'}
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Meta de Gastos (R$)</p>
                  <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 p-5 rounded-2xl font-black text-xl outline-none focus:border-[#6C7A1D]" />
                </div>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#FF7F11]">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black italic uppercase">🎫 Cupons</h3>
                  <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
               </div>
               <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                  {coupons.map(c => (
                    <div key={c.id} className="p-5 bg-gray-50 rounded-3xl border flex justify-between items-center">
                      <span className="font-black uppercase text-sm">{c.code} - {c.percentage}% OFF</span>
                      <button onClick={async () => { if(confirm('Excluir?')) { await supabase.from('coupons').delete().eq('id', c.id); fetchMarketing(); } }} className="text-red-500"><TrashIcon size={18}/></button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* ABA AJUSTES */}
        {activeTab === 'setup' && (
          <div className="max-w-xl mx-auto bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <h3 className="text-2xl font-black italic uppercase mb-10 text-center">Controle de Funcionamento</h3>
            <div className="space-y-6">
              {[
                { id: 'deliveryEnabled', label: 'Aceitar Entregas 🚚' },
                { id: 'counterEnabled', label: 'Aceitar Retiradas 🏪' }
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border">
                  <span className="font-black uppercase text-[10px] tracking-widest">{item.label}</span>
                  <button 
                    onClick={() => onUpdateStoreConfig({ ...storeConfig, [item.id]: !storeConfig[item.id as keyof StoreConfig] })}
                    className={`w-14 h-7 rounded-full relative transition-all ${storeConfig[item.id as keyof StoreConfig] ? 'bg-green-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow ${storeConfig[item.id as keyof StoreConfig] ? 'left-8' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA PEDIDOS */}
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
               <h3 className="text-xl font-black uppercase italic">Fluxo Ativo</h3>
               <button onClick={() => { 
                 setManualOrderData({ customerName: '', customerPhone: '', address: '', items: [], type: 'delivery', paymentMethod: 'Pix' });
                 setIsManualOrderModalOpen(true); 
               }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Pedido</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase text-[#FF7F11] ml-2">🚚 Entrega ({deliveryOrders.length})</h4>
                {deliveryOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`w-full bg-white p-6 rounded-[2.5rem] border-4 flex justify-between items-center shadow-md ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#FF7F11]'}`}>
                    <div className="text-left"><h5 className="font-black uppercase">{t.currentOrder?.customerName}</h5></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
              <div className="space-y-6">
                <h4 className="font-black uppercase text-[#6C7A1D] ml-2">🏪 Balcão ({takeawayOrders.length})</h4>
                {takeawayOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`w-full bg-white p-6 rounded-[2.5rem] border-4 flex justify-between items-center shadow-md ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#6C7A1D]'}`}>
                    <div className="text-left"><h5 className="font-black uppercase">{t.currentOrder?.customerName}</h5></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA MARMITAS */}
        {activeTab === 'menu' && (
          <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-black italic uppercase">Gestão de Cardápio</h3>
              <div className="flex gap-4">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none" />
                <button onClick={() => { 
                  setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '', image: '' }); 
                  setIsProductModalOpen(true); 
                }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Marmita</button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
              {filteredMenu.map(item => (
                <div key={item.id} className={`bg-gray-50 p-5 rounded-[3rem] border-2 relative shadow-sm ${!item.isAvailable ? 'opacity-40 grayscale' : 'border-transparent'}`}>
                  <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4" />
                  <h4 className="font-black text-[11px] uppercase truncate">{item.name}</h4>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 hover:bg-blue-100"><EditIcon size={18}/></button>
                    <button onClick={() => { if(confirm('Excluir marmita?')) onDeleteProduct(item.id); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-red-500 hover:bg-red-100"><TrashIcon size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
            <h3 className="text-2xl font-black italic mb-10 uppercase text-center">{editingProduct?.id ? 'Editar' : 'Nova'} Marmita</h3>
            <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
              <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DA MARMITA" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none" required />
              <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black h-24 resize-none" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black" required />
                <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL DA IMAGEM" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black" />
              <div className="flex items-center gap-4 bg-gray-100 p-5 rounded-2xl">
                <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6" />
                <label className="text-[10px] font-black uppercase">Exibir no Cardápio</label>
              </div>
              <button type="submit" className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Salvar Marmita</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PEDIDO MANUAL */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] p-12 relative shadow-2xl flex flex-col md:flex-row gap-10 max-h-[90vh] overflow-hidden">
             <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
             <div className="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar pr-4">
                <h3 className="text-2xl font-black italic uppercase">Lançar Pedido</h3>
                <input placeholder="NOME CLIENTE" value={manualOrderData.customerName} onChange={e => setManualOrderData({...manualOrderData, customerName: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black" />
                <div className="flex gap-2">
                  <button onClick={() => setManualOrderData({...manualOrderData, type: 'delivery'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'delivery' ? 'bg-[#FF7F11] text-white' : 'bg-white'}`}>Entrega</button>
                  <button onClick={() => setManualOrderData({...manualOrderData, type: 'takeaway'})} className={`flex-1 py-4 rounded-xl text-[9px] font-black uppercase border-2 ${manualOrderData.type === 'takeaway' ? 'bg-[#6C7A1D] text-white' : 'bg-white'}`}>Balcão</button>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl border space-y-3">
                  {manualOrderData.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs font-black uppercase">
                      <span>{item.quantity}x {item.name}</span>
                      <button onClick={() => setManualOrderData(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))} className="text-red-500"><TrashIcon size={14}/></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => {
                   const total = manualOrderData.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                   const range = manualOrderData.type === 'delivery' ? [900, 949] : [950, 999];
                   const tid = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free')?.id || range[0];
                   onUpdateTable(tid, 'occupied', { id: 'M'+Date.now().toString().slice(-4), customerName: manualOrderData.customerName, items: manualOrderData.items, total, finalTotal: total, paymentMethod: manualOrderData.paymentMethod, timestamp: new Date().toISOString(), tableId: tid, status: 'pending', orderType: manualOrderData.type === 'delivery' ? 'delivery' : 'counter' });
                   setIsManualOrderModalOpen(false);
                }} className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Concluir Lançamento</button>
             </div>
             <div className="flex-1 bg-gray-50 p-8 rounded-[3rem] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  {menuItems.filter(i => i.isAvailable).map(prod => (
                    <button key={prod.id} onClick={() => setManualOrderData(p => {
                      const ex = p.items.find(i => i.id === prod.id);
                      if (ex) return { ...p, items: p.items.map(i => i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i) };
                      return { ...p, items: [...p.items, { ...prod, quantity: 1 }] };
                    })} className="bg-white p-4 rounded-2xl border-2 hover:border-[#FF7F11] text-left">
                       <p className="text-[10px] font-black truncate uppercase">{prod.name}</p>
                       <p className="text-[11px] font-black text-[#FF7F11]">R$ {prod.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MODAL CUPOM */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl">
             <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-10 uppercase text-center">Criar Cupom</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               await supabase.from('coupons').insert([{ code: editingCoupon.code.toUpperCase(), percentage: editingCoupon.percentage, is_active: true, scope_type: 'all' }]);
               setIsCouponModalOpen(false); fetchMarketing();
             }} className="space-y-6">
                <input placeholder="CÓDIGO" value={editingCoupon?.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black uppercase" required />
                <input type="number" placeholder="DESCONTO %" value={editingCoupon?.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-5 text-xs font-black" required />
                <button type="submit" className="w-full bg-black text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs">Ativar Cupom</button>
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
                    <h3 className="text-3xl font-black uppercase italic text-[#1A1A1A]">{selectedOrder.currentOrder?.customerName}</h3>
                    <p className="text-[10px] font-black text-gray-400">ID: #{selectedOrder.currentOrder?.id}</p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-gray-900 text-white p-4 rounded-full"><PrinterIcon size={24}/></button>
                    <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
                 </div>
              </div>
              <div className="flex-1 space-y-8">
                 <div className="bg-gray-50 p-8 rounded-[2.5rem] border">
                    <p className="text-[9px] font-black text-gray-400 mb-4">Mudar Status</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-[#1A1A1A]' : 'bg-white text-gray-400'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-4">
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-3xl border">
                          <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" />
                          <div className="flex-1">
                             <p className="font-black text-sm uppercase">{item.name}</p>
                             <p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                          </div>
                       </div>
                    ))}
                 </div>
                 {selectedOrder.currentOrder?.address && (
                   <div className="bg-[#1A1A1A] p-6 rounded-3xl text-white">
                      <p className="text-[9px] font-black text-[#FF7F11] mb-1">Endereço de Entrega</p>
                      <p className="text-sm font-bold uppercase">{selectedOrder.currentOrder.address}</p>
                   </div>
                 )}
              </div>
              <div className="pt-10 mt-10 border-t flex justify-between items-center">
                 <p className="text-4xl font-black italic">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                 <button onClick={() => { if(confirm('Concluir?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-[#6C7A1D] text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px]">Finalizar Pedido</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
