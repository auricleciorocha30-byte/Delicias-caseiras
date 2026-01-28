
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
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({ code: '', percentage: 0, isActive: true, scopeType: 'all', scopeValue: '' });
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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

  const handleCompleteOrder = async (table: Table) => {
    const order = table.currentOrder;
    if (order && order.customerPhone) {
      const phone = order.customerPhone.replace(/\D/g, '');
      if (phone.length >= 8) {
        const { data: existingUser } = await supabase.from('loyalty_users').select('*').eq('phone', phone).maybeSingle();
        
        if (existingUser) {
          await supabase.from('loyalty_users').update({
            accumulated: Number(existingUser.accumulated) + order.finalTotal,
            name: order.customerName,
            last_update: new Date().toISOString()
          }).eq('phone', phone);
        } else {
          await supabase.from('loyalty_users').insert([{
            phone,
            name: order.customerName,
            accumulated: order.finalTotal
          }]);
        }
      }
    }
    onUpdateTable(table.id, 'free');
    setSelectedOrderId(null);
    if (activeTab === 'marketing') fetchMarketing();
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
    
    const dateStr = new Date(order.timestamp).toLocaleString('pt-BR');
    const orderTypeStr = order.orderType === 'delivery' ? 'ENTREGA' : 'RETIRADA/BALCÃO';

    const itemsHtml = order.items.map(item => `
      <div style="border-bottom: 1px dashed #ccc; padding: 4px 0;">
        <div style="display:flex;justify-content:space-between;font-weight:bold;">
          <span>${item.quantity}x ${item.name.toUpperCase()}</span>
          <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
        </div>
        ${item.observation ? `<div style="font-size: 0.8em; color: #555;">OBS: ${item.observation}</div>` : ''}
      </div>
    `).join('');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Pedido #${order.id}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              width: 80mm; 
              padding: 5mm; 
              margin: 0 auto;
              color: #000;
              font-size: 12px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; margin-bottom: 5px; }
            .hr { border-bottom: 1px solid #000; margin: 10px 0; }
            .dashed { border-bottom: 1px dashed #000; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; }
            .mt-10 { margin-top: 10px; }
            @media print {
              body { width: 80mm; margin: 0; }
              @page { margin: 0; }
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="center bold title">${STORE_INFO.name.toUpperCase()}</div>
          <div class="center">${STORE_INFO.whatsapp}</div>
          <div class="hr"></div>
          
          <div class="bold">PEDIDO: #${order.id}</div>
          <div>DATA: ${dateStr}</div>
          <div>TIPO: ${orderTypeStr}</div>
          <div class="hr"></div>
          
          <div class="bold">CLIENTE: ${order.customerName.toUpperCase()}</div>
          ${order.customerPhone ? `<div>TEL: ${order.customerPhone}</div>` : ''}
          ${order.address ? `<div class="mt-10 bold">ENDEREÇO:</div><div>${order.address}</div>` : ''}
          <div class="hr"></div>
          
          <div class="bold">ITENS DO PEDIDO:</div>
          <div class="mt-10">${itemsHtml}</div>
          
          <div class="dashed"></div>
          <div class="flex"><span>SUBTOTAL:</span><span>R$ ${order.total.toFixed(2)}</span></div>
          ${order.discount ? `<div class="flex"><span>DESCONTO:</span><span>- R$ ${order.discount.toFixed(2)}</span></div>` : ''}
          <div class="flex bold" style="font-size: 1.2em; margin-top: 5px;">
            <span>TOTAL:</span><span>R$ ${order.finalTotal.toFixed(2)}</span>
          </div>
          <div class="dashed"></div>
          
          <div class="bold">PAGAMENTO: ${order.paymentMethod.toUpperCase()}</div>
          ${order.observation ? `<div class="mt-10"><span class="bold">OBSERVAÇÃO GERAL:</span><br/>${order.observation}</div>` : ''}
          
          <div class="hr" style="margin-top: 20px;"></div>
          <div class="center bold">AGRADECEMOS A PREFERÊNCIA!</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [manualOrderItems, setManualOrderItems] = useState<CartItem[]>([]);
  const [manualCustomer, setManualCustomer] = useState({ name: '', phone: '', address: '', type: 'delivery' as any });

  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500 relative pb-10">
      {showNewOrderAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
          <button onClick={onClearAlert} className="w-full bg-brand-orange text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border-4 border-white animate-bounce">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full"><VolumeIcon size={24} className="text-brand-orange" /></div>
              <div className="text-left">
                <p className="font-black uppercase text-xs tracking-widest text-white/80">Atenção!</p>
                <p className="font-black text-xl italic leading-none">NOVO PEDIDO CHEGOU!</p>
              </div>
            </div>
            <span className="bg-brand-dark px-4 py-2 rounded-2xl text-[10px] font-black uppercase">OK</span>
          </button>
        </div>
      )}

      <div className="bg-brand-dark p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-brand-orange">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <button onClick={onTestSound} className="bg-brand-orange p-3 rounded-2xl shadow-lg hover:scale-110 transition-all"><VolumeIcon size={24} className="text-white"/></button>
            <div className="text-left">
              <h2 className="text-xl font-black italic text-brand-orange uppercase leading-none tracking-tighter">Ju Admin</h2>
              <p className="text-[9px] text-white uppercase font-black tracking-[0.2em] mt-1">Gestão Marmitas</p>
            </div>
          </div>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-4 py-3 rounded-xl md:hidden">Sair</button>
        </div>
        
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-brand-orange text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Produtos' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex gap-2">
          <button onClick={() => window.open(window.location.origin + '?view=menu', '_blank')} className="bg-brand-green text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2">Ver Cardápio</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-dark">
            <h3 className="text-xl md:text-2xl font-black italic uppercase mb-10 text-center">Ajustes do Cardápio</h3>
            <div className="space-y-6">
               <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border-2 border-dashed">
                  <div><p className="font-black text-[11px] uppercase">Delivery Ativo</p><p className="text-[9px] text-gray-400">Aceitar pedidos para entrega</p></div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, deliveryEnabled: !storeConfig.deliveryEnabled})} className={`w-14 h-7 rounded-full relative transition-all ${storeConfig.deliveryEnabled ? 'bg-brand-green' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${storeConfig.deliveryEnabled ? 'left-8' : 'left-1'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border-2 border-dashed">
                  <div><p className="font-black text-[11px] uppercase">Retirada Ativa</p><p className="text-[9px] text-gray-400">Aceitar pedidos para retirada</p></div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, counterEnabled: !storeConfig.counterEnabled})} className={`w-14 h-7 rounded-full relative transition-all ${storeConfig.counterEnabled ? 'bg-brand-green' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${storeConfig.counterEnabled ? 'left-8' : 'left-1'}`}></div>
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="space-y-12 px-2 md:px-0">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border gap-4">
               <h3 className="text-xl font-black uppercase italic">Fluxo de Marmitas</h3>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="w-full md:w-auto bg-brand-dark text-brand-orange px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Lançar Pedido</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase text-brand-orange ml-2">🚚 Entregas ({deliveryOrders.length})</h4>
                {deliveryOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-brand-orange flex justify-between items-center shadow-md text-left">
                    <div><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
              <div className="space-y-6">
                <h4 className="font-black uppercase text-brand-green ml-2">🏪 Balcão ({takeawayOrders.length})</h4>
                {takeawayOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-brand-green flex justify-between items-center shadow-md text-left">
                    <div><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketing' && (
          <div className="space-y-10">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-green">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">Programa de Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`w-16 h-8 rounded-full relative transition-all ${loyalty.isActive ? 'bg-brand-green' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${loyalty.isActive ? 'left-9' : 'left-1'}`}></div>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2">Meta de Gasto (R$)</p>
                  <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-brand-green" />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-orange">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">Cupons de Desconto</h3>
                <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-brand-dark text-brand-orange px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Novo Cupom</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(c => (
                  <div key={c.id} className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-black italic text-brand-orange">{c.code}</h4>
                        <p className="text-[10px] font-black text-gray-400 uppercase">{c.percentage}% OFF</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 bg-white rounded-xl shadow-sm text-red-500"><TrashIcon size={16}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-dark">
              <h3 className="text-2xl font-black italic uppercase mb-10">Ranking de Clientes</h3>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead className="border-b-2">
                    <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      <th className="pb-4">Cliente</th>
                      <th className="pb-4">WhatsApp</th>
                      <th className="pb-4">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loyaltyUsers.map(user => (
                      <tr key={user.phone} className="text-[11px] font-bold">
                        <td className="py-5 uppercase">{user.name}</td>
                        <td className="py-5">{user.phone}</td>
                        <td className="py-5 text-brand-orange font-black">R$ {user.accumulated.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedOrderId(null)} />
           <div className="relative bg-white w-full max-w-2xl h-[80vh] rounded-[2.5rem] p-6 md:p-10 overflow-y-auto flex flex-col border-t-8 border-brand-orange">
              <div className="flex justify-between items-start mb-6">
                 <div><h3 className="text-2xl md:text-3xl font-black uppercase italic">{selectedOrder.currentOrder?.customerName}</h3><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">#{selectedOrder.currentOrder?.id}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-brand-dark text-brand-orange p-3 rounded-full hover:scale-110 transition-all shadow-lg"><PrinterIcon size={20}/></button>
                    <button onClick={() => setSelectedOrderId(null)} className="p-3 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
                 </div>
              </div>
              <div className="flex-1 space-y-6">
                 <div className="bg-gray-50 p-6 rounded-2xl border">
                    <p className="text-[8px] font-black text-gray-400 mb-4 uppercase tracking-widest">Gerenciar Status</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-3 rounded-xl text-[8px] font-black uppercase border-2 ${selectedOrder.currentOrder?.status === s ? 'bg-brand-orange text-white border-brand-dark' : 'bg-white text-gray-400'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-3">
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-3 bg-white p-4 rounded-xl border">
                          <img src={item.image} onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100?text=Food'; }} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1">
                            <p className="font-black text-[10px] uppercase leading-tight">{item.name}</p>
                            <p className="text-[9px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                            {item.observation && <p className="text-[9px] italic text-brand-orange">Obs: {item.observation}</p>}
                          </div>
                          <span className="font-black italic text-brand-orange text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="pt-6 mt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                 <div className="text-center md:text-left"><p className="text-[9px] text-gray-400 uppercase font-black">Total</p><p className="text-3xl font-black italic">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p></div>
                 <button onClick={() => handleCompleteOrder(selectedOrder)} className="w-full md:w-auto bg-brand-green text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] shadow-xl">Concluir Pedido ✅</button>
              </div>
           </div>
        </div>
      )}
      
      {/* MODAL PEDIDO MANUAL (PDV) */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3rem] p-8 md:p-12 relative flex flex-col">
            <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full"><CloseIcon size={24}/></button>
            <h3 className="text-2xl font-black uppercase italic mb-10">Ponto de Venda (PDV)</h3>
            
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-hidden">
               <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar pr-2">
                  <div className="grid grid-cols-1 gap-2">
                     {menuItems.map(item => (
                        <button key={item.id} onClick={() => {
                           const ex = manualOrderItems.find(i => i.id === item.id);
                           if(ex) setManualOrderItems(manualOrderItems.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
                           else setManualOrderItems([...manualOrderItems, {...item, quantity: 1}]);
                        }} className="flex items-center gap-4 bg-gray-50 p-3 rounded-2xl border hover:border-brand-orange transition-all text-left">
                           <img src={item.image} className="w-12 h-12 rounded-xl object-cover" onError={(e)=>e.currentTarget.src='https://placehold.co/100x100?text=Food'}/>
                           <div className="flex-1">
                              <p className="text-[11px] font-black uppercase leading-tight">{item.name}</p>
                              <p className="text-[10px] font-bold text-brand-orange">R$ {item.price.toFixed(2)}</p>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex flex-col gap-6 bg-gray-50 p-6 rounded-[2.5rem] border border-dashed">
                  <div className="space-y-3">
                    <input value={manualCustomer.name} onChange={e => setManualCustomer({...manualCustomer, name: e.target.value})} placeholder="NOME DO CLIENTE" className="w-full bg-white border-2 rounded-xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-brand-orange" />
                    <input value={manualCustomer.phone} onChange={e => setManualCustomer({...manualCustomer, phone: e.target.value})} placeholder="WHATSAPP (OPCIONAL)" className="w-full bg-white border-2 rounded-xl px-5 py-4 text-xs font-black outline-none focus:border-brand-orange" />
                    <div className="flex gap-2">
                       <button onClick={() => setManualCustomer({...manualCustomer, type: 'delivery'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${manualCustomer.type === 'delivery' ? 'bg-brand-orange text-white border-brand-orange shadow-md' : 'bg-white text-gray-400'}`}>Entrega</button>
                       <button onClick={() => setManualCustomer({...manualCustomer, type: 'counter'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 ${manualCustomer.type === 'counter' ? 'bg-brand-green text-white border-brand-green shadow-md' : 'bg-white text-gray-400'}`}>Balcão</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 border-t pt-4">
                     {manualOrderItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                           <span>{item.quantity}x {item.name}</span>
                           <div className="flex items-center gap-3">
                              <span className="text-brand-orange">R$ {(item.price * item.quantity).toFixed(2)}</span>
                              <button onClick={() => setManualOrderItems(manualOrderItems.filter(i => i.id !== item.id))} className="text-red-500 font-black">×</button>
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="border-t pt-4">
                     <div className="flex justify-between items-end mb-4">
                        <span className="text-[10px] font-black uppercase">Subtotal</span>
                        <span className="text-3xl font-black italic">R$ {manualOrderItems.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</span>
                     </div>
                     <button onClick={handleCreateManualOrder} className="w-full bg-brand-dark text-brand-orange py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Lançar Pedido</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
