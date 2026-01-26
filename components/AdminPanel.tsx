
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
  
  // Modais
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

  // Estado para Novo Pedido Manual
  const [manualOrderData, setManualOrderData] = useState<{
    customerName: string;
    customerPhone: string;
    address: string;
    items: CartItem[];
    type: 'delivery' | 'takeaway';
    paymentMethod: string;
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

  // Função de Impressão Térmica 80mm
  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">
        <span>${item.quantity}x ${item.name.toUpperCase()}</span>
        <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Impressão de Pedido</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              margin: 0; 
              padding: 10mm; 
              font-size: 14px; 
              color: #000; 
              background: #fff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .header { font-size: 18px; margin-bottom: 5px; }
            .total { font-size: 20px; margin-top: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="center bold header">${STORE_INFO.name.toUpperCase()}</div>
          <div class="center">${STORE_INFO.slogan}</div>
          <div class="divider"></div>
          <div class="bold">PEDIDO: #${order.id}</div>
          <div>DATA: ${new Date(order.timestamp).toLocaleString('pt-BR')}</div>
          <div>TIPO: ${order.orderType === 'delivery' ? 'ENTREGA 🚚' : 'RETIRADA 🏪'}</div>
          <div class="divider"></div>
          <div class="bold">CLIENTE: ${order.customerName.toUpperCase()}</div>
          ${order.customerPhone ? `<div>TEL: ${order.customerPhone}</div>` : ''}
          ${order.address ? `<div class="bold">ENDEREÇO: ${order.address.toUpperCase()}</div>` : ''}
          <div class="divider"></div>
          <div class="bold">ITENS:</div>
          ${itemsHtml}
          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between;">
            <span>SUBTOTAL:</span>
            <span>R$ ${order.total.toFixed(2)}</span>
          </div>
          ${order.discount ? `
          <div style="display: flex; justify-content: space-between;">
            <span>DESCONTO:</span>
            <span>- R$ ${order.discount.toFixed(2)}</span>
          </div>` : ''}
          <div class="divider"></div>
          <div class="bold total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>R$ ${order.finalTotal.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="bold">PAGAMENTO: ${order.paymentMethod.toUpperCase()}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 20px;">OBRIGADO PELA PREFERÊNCIA!</div>
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
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Cardápio' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="flex gap-4">
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA MARKETING - RESTAURADA */}
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
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Meta de Gastos R$</p>
                  <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 p-5 rounded-2xl font-black text-xl outline-none focus:border-[#6C7A1D] transition-all" />
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-4">Escopo do Programa</p>
                  <div className="flex gap-2">
                    {(['all', 'category', 'product'] as const).map(type => (
                      <button key={type} onClick={() => handleUpdateLoyalty({ scopeType: type, scopeValue: '' })} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${loyalty.scopeType === type ? 'bg-[#6C7A1D] text-white border-[#6C7A1D]' : 'bg-white border-gray-100'}`}>{type}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#FF7F11]">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black italic uppercase">🎫 Cupons</h3>
                  <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
               </div>
               <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {coupons.map(coupon => (
                    <div key={coupon.id} className="p-6 bg-gray-50 rounded-[2.5rem] border-2 border-gray-100 flex justify-between items-center">
                      <div>
                        <span className="bg-[#1A1A1A] text-[#FF7F11] px-4 py-1.5 rounded-lg font-black text-sm uppercase">{coupon.code}</span>
                        <p className="text-[#6C7A1D] font-black text-[12px] mt-2 uppercase">{coupon.percentage}% OFF</p>
                      </div>
                      <button onClick={async () => { if(confirm('Excluir?')) { await supabase.from('coupons').delete().eq('id', coupon.id); fetchMarketing(); } }} className="text-red-500"><TrashIcon size={20}/></button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* ABA AJUSTES - RESTAURADA */}
        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
              <h3 className="text-2xl font-black italic uppercase mb-8 text-center">Configuração de Serviços</h3>
              <div className="space-y-4">
                {[
                  { id: 'deliveryEnabled', label: 'Entrega em Casa', icon: '🚚' },
                  { id: 'counterEnabled', label: 'Retirada no Balcão', icon: '🏪' },
                  { id: 'statusPanelEnabled', label: 'Painel de Status', icon: '📺' }
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="font-black uppercase text-[10px] tracking-widest">{item.label}</span>
                    </div>
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
          </div>
        )}

        {/* ABA PEDIDOS */}
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
               <div>
                  <h3 className="text-xl font-black uppercase italic text-[#1A1A1A]">Painel de Controle</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Controle de Produção e Entregas</p>
               </div>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Criar Pedido Local</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase italic text-[#FF7F11] ml-2">🚚 Delivery ({deliveryOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {deliveryOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center shadow-md transition-all ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#FF7F11]'}`}>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">#{t.currentOrder?.id}</p>
                        <h5 className="font-black text-lg uppercase text-[#1A1A1A]">{t.currentOrder?.customerName}</h5>
                      </div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>
                        {STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-black uppercase italic text-[#6C7A1D] ml-2">🏪 Retiradas ({takeawayOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {takeawayOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center shadow-md transition-all ${t.currentOrder?.status === 'pending' ? 'border-orange-500' : 'border-[#6C7A1D]'}`}>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">#{t.currentOrder?.id}</p>
                        <h5 className="font-black text-lg uppercase text-[#1A1A1A]">{t.currentOrder?.customerName}</h5>
                      </div>
                      <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>
                        {STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA CARDÁPIO */}
        {activeTab === 'menu' && (
          <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-black italic uppercase">Gestão de Marmitas</h3>
              <div className="flex gap-4">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" />
                <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '' }); setIsProductModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Marmita</button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
              {filteredMenu.map(item => (
                <div key={item.id} className={`bg-gray-50 p-5 rounded-[3rem] border-2 transition-all relative group shadow-sm ${!item.isAvailable ? 'opacity-40 grayscale' : 'border-transparent hover:border-[#FF7F11]'}`}>
                  <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4" />
                  <h4 className="font-black text-[11px] uppercase truncate">{item.name}</h4>
                  <p className="text-[#FF7F11] font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500"><EditIcon size={18}/></button>
                    <button onClick={() => onSaveProduct({ ...item, isAvailable: !item.isAvailable })} className={`flex-1 p-3 rounded-xl shadow-sm ${item.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {item.isAvailable ? 'Ativo' : 'OFF'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHES PEDIDO COM IMPRESSÃO */}
      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
           <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 overflow-y-auto flex flex-col border-t-8 border-[#FF7F11]">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[#1A1A1A]">{selectedOrder.currentOrder?.customerName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                      #{selectedOrder.currentOrder?.id} • {selectedOrder.id >= 950 ? 'Retirada' : 'Entrega'}
                    </p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-gray-900 text-white p-4 rounded-full hover:scale-105 transition-all"><PrinterIcon size={24}/></button>
                    <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
                 </div>
              </div>

              <div className="flex-1 space-y-8">
                 <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-4 ml-2">Status da Marmitaria</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-[#1A1A1A]' : 'bg-white text-gray-400 border-transparent'}`}>
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
                             <p className="font-black text-sm uppercase text-[#1A1A1A]">{item.name}</p>
                             <p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                          </div>
                          <span className="font-black italic text-[#FF7F11]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>

                 {selectedOrder.currentOrder?.address && (
                   <div className="bg-[#1A1A1A] p-8 rounded-3xl text-white">
                      <p className="text-[9px] font-black uppercase text-[#FF7F11] mb-2">Endereço de Entrega</p>
                      <p className="text-sm font-bold uppercase leading-relaxed">{selectedOrder.currentOrder.address}</p>
                   </div>
                 )}
              </div>

              <div className="pt-10 mt-10 border-t flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Final</p>
                    <p className="text-4xl font-black italic text-[#1A1A1A]">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                 </div>
                 <button onClick={() => { if(confirm('Finalizar Pedido?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-[#6C7A1D] text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Concluir ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
