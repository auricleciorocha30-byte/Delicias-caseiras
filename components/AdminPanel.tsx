
import React, { useState, useEffect, useRef } from 'react';
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
  const [selectedCatFilter, setSelectedCatFilter] = useState('Todas');
  
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [pdvSearchTerm, setPdvSearchTerm] = useState('');
  const [manualOrderItems, setManualOrderItems] = useState<CartItem[]>([]);
  const [manualCustomer, setManualCustomer] = useState({ 
    name: '', phone: '', address: '', type: 'counter' as any, paymentMethod: 'Pix' as any
  });

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({ code: '', percentage: 0, isActive: true, scopeType: 'all', scopeValue: '' });

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'marketing') fetchMarketing();
  }, [activeTab]);

  const fetchMarketing = async () => {
    const { data: cData } = await supabase.from('coupons').select('*');
    if (cData) setCoupons(cData.map(c => ({ 
      id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, 
      scopeType: c.scope_type as any, scopeValue: c.scope_value || '' 
    })));
    
    const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
    if (lConfig) setLoyalty({ 
      isActive: lConfig.is_active, 
      spendingGoal: Number(lConfig.spending_goal), 
      scopeType: lConfig.scope_type as any, 
      scopeValue: lConfig.scope_value || '' 
    });
    
    const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
    if (lUsers) {
      setLoyaltyUsers(lUsers.map(u => ({ 
        phone: u.phone, 
        name: u.name || 'Cliente sem nome', 
        accumulated: Number(u.accumulated || 0) 
      })));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem é muito grande. Escolha uma imagem com menos de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingProduct({ ...editingProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteLoyaltyUser = async (phone: string) => {
    if (confirm('Deseja excluir este cliente do programa de fidelidade? Esta ação é irreversível.')) {
      const { error } = await supabase.from('loyalty_users').delete().eq('phone', phone);
      if (!error) fetchMarketing();
      else alert('Erro ao excluir cliente.');
    }
  };

  const handleUpdateLoyalty = async (updates: Partial<LoyaltyConfig>) => {
    const next = { ...loyalty, ...updates };
    setLoyalty(next);
    await supabase.from('loyalty_config').upsert({ 
      id: 1, is_active: next.isActive, spending_goal: next.spendingGoal, 
      scope_type: next.scopeType, scope_value: next.scopeValue 
    });
  };

  const handleSaveCoupon = async () => {
    if (!editingCoupon.code) return;
    const { error } = await supabase.from('coupons').upsert({
      id: editingCoupon.id || undefined,
      code: editingCoupon.code.toUpperCase().trim(),
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
    if (error) alert('Erro ao adicionar categoria.');
    else { setNewCatName(''); onRefreshData(); }
  };

  const handleDeleteCategory = async (name: string) => {
    if (confirm(`Excluir a categoria "${name}"?`)) {
      await supabase.from('categories').delete().eq('name', name);
      onRefreshData();
    }
  };

  const handleCreateManualOrder = async () => {
    if (!manualCustomer.name || manualOrderItems.length === 0) return alert('Preencha os dados.');
    const subtotal = manualOrderItems.reduce((a, b) => a + (b.price * b.quantity), 0);
    const range = manualCustomer.type === 'delivery' ? [900, 949] : [950, 999];
    const freeTable = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free');
    const tableId = freeTable?.id || range[0];

    const newOrder: Order = {
      id: 'PDV-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      customerName: manualCustomer.name,
      customerPhone: manualCustomer.phone,
      items: manualOrderItems,
      total: subtotal,
      finalTotal: subtotal,
      paymentMethod: manualCustomer.paymentMethod,
      timestamp: new Date().toISOString(),
      tableId,
      orderType: manualCustomer.type,
      address: manualCustomer.address,
      status: 'pending'
    };

    onUpdateTable(tableId, 'occupied', newOrder);
    setManualOrderItems([]);
    setManualCustomer({ name: '', phone: '', address: '', type: 'counter', paymentMethod: 'Pix' });
    setIsManualOrderModalOpen(false);
    onRefreshData();
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
          await supabase.from('loyalty_users').insert([{ phone, name: order.customerName, accumulated: order.finalTotal }]);
        }
      }
    }
    onUpdateTable(table.id, 'free');
    setSelectedOrderId(null);
    if (activeTab === 'marketing') fetchMarketing();
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateStr = new Date(order.timestamp).toLocaleString('pt-BR');
    const itemsHtml = order.items.map(item => `
      <div style="border-bottom: 1px dashed #ccc; padding: 4px 0; display: flex; justify-content: space-between;">
        <span>${item.quantity}x ${item.name}</span>
        <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
      </div>`).join('');
    
    printWindow.document.write(`<html><body onload="window.print();window.close();" style="font-family:monospace;width:80mm;font-size:12px;">
      <h3 style="text-align:center;">${STORE_INFO.name}</h3><hr/>
      <div>PEDIDO: #${order.id}</div><div>DATA: ${dateStr}</div><hr/>
      <div>CLIENTE: ${order.customerName}</div>${order.address ? `<div>ENDEREÇO: ${order.address}</div>` : ''}<hr/>
      ${itemsHtml}<hr/>
      <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>TOTAL:</span><span>R$ ${order.finalTotal.toFixed(2)}</span></div>
      <div>PAGAMENTO: ${order.paymentMethod}</div>
    </body></html>`);
    printWindow.document.close();
  };

  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  const selectedOrder = tables.find(t => t.id === selectedOrderId);
  const filteredProds = menuItems.filter(p => (selectedCatFilter === 'Todas' || p.category === selectedCatFilter) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full animate-in fade-in duration-500 pb-10 relative">
      
      {/* ALERTA VISUAL DE NOVO PEDIDO */}
      {showNewOrderAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-md">
          <div className="bg-brand-orange text-white p-6 rounded-[2rem] shadow-2xl border-4 border-white animate-bounce flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="bg-white text-brand-orange p-3 rounded-2xl">
                 <VolumeIcon size={24} />
               </div>
               <div>
                 <p className="font-black uppercase text-[12px] leading-tight">Novo Pedido!</p>
                 <p className="text-[10px] font-bold opacity-80 uppercase">Chegou marmita nova na área.</p>
               </div>
             </div>
             <button onClick={onClearAlert} className="bg-brand-dark text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase">OK</button>
          </div>
        </div>
      )}

      {/* HEADER ADMIN */}
      <div className="bg-brand-dark p-6 rounded-[2.5rem] shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-brand-orange">
        <div className="flex items-center gap-4" onClick={onTestSound}>
          <button className="bg-brand-orange p-3 rounded-2xl text-white shadow-lg"><VolumeIcon size={24}/></button>
          <div className="cursor-pointer">
            <h2 className="text-xl font-black italic text-brand-orange uppercase leading-none">Ju Admin</h2>
            <p className="text-[9px] text-white uppercase font-black tracking-widest mt-1">Gestão Marmitas</p>
          </div>
        </div>
        
        <nav className="flex bg-gray-900 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar max-w-full">
          {(['delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab ? 'bg-brand-orange text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Produtos' : tab === 'marketing' ? 'Marketing' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="flex gap-2">
          <button onClick={() => window.open(window.location.origin + '?view=menu', '_blank')} className="bg-brand-green text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Ver meu Cardápio</button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {/* ABA PEDIDOS */}
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border">
               <h3 className="text-xl font-black uppercase italic">Pedidos Ativos</h3>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="bg-brand-dark text-brand-orange px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Lançar Pedido (PDV)</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="font-black uppercase text-brand-orange ml-2 tracking-widest">🚚 Delivery ({deliveryOrders.length})</h4>
                {deliveryOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-brand-orange flex justify-between items-center shadow-md text-left transition-all hover:translate-x-1 active:scale-95">
                    <div><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
                {deliveryOrders.length === 0 && <p className="text-center py-10 text-gray-400 uppercase font-black text-[10px] opacity-30">Nenhum pedido de delivery</p>}
              </div>
              <div className="space-y-6">
                <h4 className="font-black uppercase text-brand-green ml-2 tracking-widest">🏪 Retirada ({takeawayOrders.length})</h4>
                {takeawayOrders.map(t => (
                  <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className="w-full bg-white p-5 rounded-[2rem] border-4 border-brand-green flex justify-between items-center shadow-md text-left transition-all hover:translate-x-1 active:scale-95">
                    <div><h5 className="font-black uppercase text-sm">{t.currentOrder?.customerName}</h5><p className="text-[9px] text-gray-400">#{t.currentOrder?.id}</p></div>
                    <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-4 py-2 rounded-full uppercase`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                  </button>
                ))}
                {takeawayOrders.length === 0 && <p className="text-center py-10 text-gray-400 uppercase font-black text-[10px] opacity-30">Nenhum pedido de retirada</p>}
              </div>
            </div>
          </div>
        )}

        {/* ABA PRODUTOS */}
        {activeTab === 'menu' && (
          <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-brand-dark">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
              <h3 className="text-3xl font-black italic uppercase">Gestão Marmitas</h3>
              <div className="flex gap-4">
                <button onClick={() => setIsCategoryModalOpen(true)} className="bg-gray-100 text-gray-600 px-6 py-4 rounded-2xl font-black text-[9px] uppercase">Categorias</button>
                <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '', image: '' }); setIsProductModalOpen(true); }} className="bg-brand-dark text-brand-orange px-6 py-4 rounded-2xl font-black text-[9px] uppercase shadow-xl hover:scale-105 transition-all">+ Novo Item</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR MARMITA..." className="md:col-span-3 bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-brand-orange" />
              <select value={selectedCatFilter} onChange={e => setSelectedCatFilter(e.target.value)} className="bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black outline-none">
                <option value="Todas">Todas</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProds.map(item => (
                <div key={item.id} className="bg-gray-100 p-4 rounded-[2.5rem] border-2 border-transparent shadow-sm flex flex-col">
                  <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4 shadow-inner" onError={e => e.currentTarget.src='https://placehold.co/400x400/FF7F11/FFFFFF?text=' + item.name.charAt(0)}/>
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-brand-green uppercase mb-1">{item.category}</p>
                    <h4 className="font-black text-[11px] uppercase truncate">{item.name}</h4>
                    <p className="text-[10px] font-black text-brand-orange mt-1">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-2xl text-blue-500 shadow-sm border border-blue-50"><EditIcon size={16}/></button>
                    <button onClick={() => onDeleteProduct(item.id)} className="flex-1 bg-white p-3 rounded-2xl text-red-500 shadow-sm border border-red-50"><TrashIcon size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA MARKETING (RESTAURADA TOTALMENTE) */}
        {activeTab === 'marketing' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* PROGRAMA DE FIDELIDADE */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-green">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase leading-none">Programa Fidelidade</h3>
                <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`w-16 h-8 rounded-full relative transition-all ${loyalty.isActive ? 'bg-brand-green' : 'bg-gray-300'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${loyalty.isActive ? 'left-9' : 'left-1'}`}></div></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Meta de Gasto (R$)</p>
                  <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-brand-green" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Aplica-se a:</p>
                  <select value={loyalty.scopeType} onChange={e => handleUpdateLoyalty({ scopeType: e.target.value as any, scopeValue: '' })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
                    <option value="all">Toda a Loja</option>
                    <option value="category">Categoria Específica</option>
                    <option value="product">Produto Específico</option>
                  </select>
                </div>
                {loyalty.scopeType !== 'all' && (
                  <div className="space-y-2 animate-in slide-in-from-top duration-300">
                    <p className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Qual {loyalty.scopeType === 'category' ? 'Categoria' : 'Produto'}?</p>
                    {loyalty.scopeType === 'category' ? (
                      <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
                        <option value="">Selecione...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : (
                      <select value={loyalty.scopeValue} onChange={e => handleUpdateLoyalty({ scopeValue: e.target.value })} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
                        <option value="">Selecione...</option>
                        {menuItems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* GESTÃO DE CUPONS */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-orange">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase leading-none">Cupons de Desconto</h3>
                <button onClick={() => { setEditingCoupon({ code: '', percentage: 10, isActive: true, scopeType: 'all', scopeValue: '' }); setIsCouponModalOpen(true); }} className="bg-brand-dark text-brand-orange px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all">+ Novo Cupom</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(c => (
                  <div key={c.id} className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200 flex flex-col items-center text-center shadow-sm relative group">
                    <h4 className="text-2xl font-black italic text-brand-orange mb-1 tracking-tighter uppercase">{c.code}</h4>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{c.percentage}% OFF • {c.isActive ? 'Ativo' : 'Inativo'}</p>
                    <p className="text-[8px] font-black text-gray-300 uppercase mt-2">Escopo: {c.scopeType === 'all' ? 'Tudo' : c.scopeType === 'category' ? 'Categoria' : 'Produto'}</p>
                    <button onClick={() => handleDeleteCoupon(c.id)} className="mt-4 p-3 bg-white text-red-500 rounded-xl shadow-sm hover:bg-red-50 transition-all"><TrashIcon size={18}/></button>
                  </div>
                ))}
                {coupons.length === 0 && <p className="col-span-full text-center py-10 text-gray-400 uppercase font-black text-[10px] opacity-30 italic">Nenhum cupom cadastrado</p>}
              </div>
            </div>

            {/* RANKING DE CLIENTES */}
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border-t-8 border-brand-dark overflow-hidden">
              <h3 className="text-2xl font-black italic uppercase mb-10 leading-none">Ranking de Clientes</h3>
              <div className="overflow-x-auto no-scrollbar -mx-8 md:-mx-12">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="border-b-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    <tr><th className="px-8 md:px-12 pb-4">Cliente</th><th className="pb-4">WhatsApp</th><th className="pb-4 text-right">Acumulado</th><th className="pb-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y text-[11px] font-bold">
                    {loyaltyUsers.map((user, idx) => (
                      <tr key={user.phone} className="hover:bg-gray-50 transition-all group">
                        <td className="px-8 md:px-12 py-5 uppercase truncate max-w-[200px]">
                          <span className="text-brand-orange mr-2">#{idx+1}</span>
                          {user.name}
                        </td>
                        <td className="py-5 font-mono text-gray-400">{user.phone}</td>
                        <td className="py-5 text-right text-brand-orange font-black text-[13px]">R$ {user.accumulated.toFixed(2)}</td>
                        <td className="py-5 text-center">
                          <button onClick={() => handleDeleteLoyaltyUser(user.phone)} className="text-red-300 hover:text-red-600 transition-colors p-2">
                             <TrashIcon size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {loyaltyUsers.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-gray-400 uppercase font-black text-[10px] opacity-30 italic">Nenhum cliente registrado no programa</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA AJUSTES (RESTAURADA TOTALMENTE) */}
        {activeTab === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border-t-8 border-brand-dark animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black italic uppercase mb-12 text-center leading-none">Configurações da Loja</h3>
            <div className="space-y-6">
               <div className="flex items-center justify-between p-6 md:p-8 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-brand-green/30 transition-all">
                  <div>
                    <p className="font-black text-[13px] uppercase text-brand-dark">Entregas (Delivery)</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Habilitar/Desabilitar no cardápio</p>
                  </div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, deliveryEnabled: !storeConfig.deliveryEnabled})} className={`w-16 h-8 rounded-full relative transition-all ${storeConfig.deliveryEnabled ? 'bg-brand-green shadow-inner' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${storeConfig.deliveryEnabled ? 'left-9' : 'left-1'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between p-6 md:p-8 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 hover:border-brand-green/30 transition-all">
                  <div>
                    <p className="font-black text-[13px] uppercase text-brand-dark">Retirada / Balcão</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Habilitar/Desabilitar no cardápio</p>
                  </div>
                  <button onClick={() => onUpdateStoreConfig({...storeConfig, counterEnabled: !storeConfig.counterEnabled})} className={`w-16 h-8 rounded-full relative transition-all ${storeConfig.counterEnabled ? 'bg-brand-green shadow-inner' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${storeConfig.counterEnabled ? 'left-9' : 'left-1'}`}></div>
                  </button>
               </div>
            </div>
            
            <div className="mt-12 pt-12 border-t text-center">
               <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{STORE_INFO.name} Admin v2.0</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PDV (MANTIDO COM AJUSTES MOBILE) */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl h-[95vh] md:h-[90vh] rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 relative flex flex-col shadow-2xl overflow-y-auto md:overflow-hidden no-scrollbar">
            <button onClick={() => setIsManualOrderModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-3 md:p-4 bg-gray-100 rounded-full active:scale-90 transition-all z-20"><CloseIcon size={20}/></button>
            <div className="mb-6 md:mb-8 pr-12"><h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-brand-dark leading-none">PDV</h3><p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Lançamento de pedido presencial</p></div>
            
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 md:overflow-hidden">
               <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6 md:overflow-hidden">
                  <input type="text" value={pdvSearchTerm} onChange={e => setPdvSearchTerm(e.target.value)} placeholder="PESQUISAR ITEM..." className="w-full bg-gray-50 border-2 rounded-xl md:rounded-2xl px-5 py-3 md:px-6 md:py-4 text-xs font-black outline-none focus:border-brand-orange" />
                  <div className="flex-1 min-h-[250px] overflow-y-auto no-scrollbar space-y-3 pb-4">
                     {menuItems.filter(p => p.isAvailable && p.name.toLowerCase().includes(pdvSearchTerm.toLowerCase())).map(item => (
                        <button key={item.id} onClick={() => {
                          const ex = manualOrderItems.find(i => i.id === item.id);
                          if(ex) setManualOrderItems(manualOrderItems.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
                          else setManualOrderItems([...manualOrderItems, {...item, quantity: 1}]);
                        }} className="w-full flex items-center gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-xl border-2 border-transparent hover:border-brand-orange/30 shadow-sm text-left active:scale-[0.98] transition-all">
                           <img src={item.image} className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover shadow-inner" onError={e => e.currentTarget.src='https://placehold.co/100x100'}/>
                           <div className="flex-1"><p className="text-[11px] md:text-[13px] font-black uppercase text-brand-dark leading-tight">{item.name}</p><p className="text-[10px] font-black text-brand-orange mt-1">R$ {item.price.toFixed(2)}</p></div>
                           <div className="bg-gray-100 p-2 md:p-3 rounded-lg"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg></div>
                        </button>
                     ))}
                  </div>
               </div>
               <div className="lg:col-span-5 flex flex-col gap-6 bg-gray-50 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-gray-200 shadow-inner md:overflow-hidden">
                  <div className="space-y-3">
                    <input value={manualCustomer.name} onChange={e => setManualCustomer({...manualCustomer, name: e.target.value})} placeholder="NOME DO CLIENTE" className="w-full bg-white border-2 rounded-xl px-4 py-3 text-[11px] font-black uppercase outline-none focus:border-brand-orange" />
                    <input value={manualCustomer.phone} onChange={e => setManualCustomer({...manualCustomer, phone: e.target.value})} placeholder="WHATSAPP (OPCIONAL)" className="w-full bg-white border-2 rounded-xl px-4 py-3 text-[11px] font-black outline-none focus:border-brand-orange" />
                    <div className="flex gap-2">
                       {(['counter', 'delivery'] as const).map(type => (
                         <button key={type} onClick={() => setManualCustomer({...manualCustomer, type})} className={`flex-1 py-3 rounded-xl text-[8px] md:text-[9px] font-black uppercase border-2 transition-all ${manualCustomer.type === type ? 'bg-brand-dark text-white shadow-md' : 'bg-white text-gray-400'}`}>{type === 'counter' ? 'Balcão' : 'Entrega'}</button>
                       ))}
                    </div>
                    {manualCustomer.type === 'delivery' && <textarea value={manualCustomer.address} onChange={e => setManualCustomer({...manualCustomer, address: e.target.value})} placeholder="ENDEREÇO..." className="w-full bg-white border-2 rounded-xl px-4 py-3 text-[10px] font-black h-16 resize-none outline-none shadow-sm animate-in slide-in-from-top duration-300"/>}
                    <div className="grid grid-cols-3 gap-2">
                      {(['Pix', 'Dinheiro', 'Cartão'] as const).map(m => (
                        <button key={m} onClick={() => setManualCustomer({...manualCustomer, paymentMethod: m})} className={`py-3 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${manualCustomer.paymentMethod === m ? 'bg-brand-orange text-white border-brand-orange shadow-md' : 'bg-white text-gray-400'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[100px] overflow-y-auto no-scrollbar space-y-2 pt-4 border-t">
                     {manualOrderItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-[10px] font-black uppercase bg-white p-2 md:p-3 rounded-xl border shadow-sm">
                           <span className="flex-1 truncate pr-2"><span className="text-brand-orange mr-1">{item.quantity}x</span> {item.name}</span>
                           <div className="flex items-center gap-3"><span>R$ {(item.price * item.quantity).toFixed(2)}</span><button onClick={() => setManualOrderItems(manualOrderItems.filter(i => i.id !== item.id))} className="text-red-500 font-black p-1 hover:bg-red-50 rounded-md transition-all">×</button></div>
                        </div>
                     ))}
                     {manualOrderItems.length === 0 && <p className="text-center py-6 md:py-10 opacity-20 font-black uppercase text-[10px]">Sacola Vazia</p>}
                  </div>
                  <div className="border-t pt-4 md:pt-6 bg-gray-50 sticky bottom-0">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-[9px] font-black text-gray-400 uppercase">Total</span>
                       <p className="text-2xl md:text-3xl font-black italic tracking-tighter leading-none">R$ {manualOrderItems.reduce((a, b) => a + (b.price * b.quantity), 0).toFixed(2)}</p>
                    </div>
                    <button onClick={handleCreateManualOrder} className="w-full bg-brand-dark text-brand-orange py-4 md:py-6 rounded-2xl font-black uppercase text-[10px] md:text-[11px] shadow-2xl active:scale-95 transition-all">Lançar Pedido</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE CONFIGURAÇÃO (PRODUTO, CATEGORIA, CUPOM) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 relative shadow-2xl overflow-y-auto max-h-[95vh] no-scrollbar">
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full active:scale-90 transition-all"><CloseIcon size={20}/></button>
            <h3 className="text-2xl font-black italic mb-8 uppercase text-center tracking-tighter text-brand-dark leading-none">Configurar Marmita</h3>
            <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">Foto da Marmita</p>
                <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-gray-50 border-4 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-all group overflow-hidden relative">
                  {editingProduct?.image ? (
                    <>
                      <img src={editingProduct.image} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="bg-white text-brand-dark px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-xl">Trocar Foto</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8">
                      <div className="bg-white text-brand-orange p-4 rounded-full shadow-md mb-4 inline-block"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg></div>
                      <p className="font-black text-[10px] uppercase tracking-widest text-gray-400">Clique para selecionar foto</p>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
              <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DO PRODUTO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-brand-orange" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none" required />
                <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
              </div>
              <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO / INGREDIENTES" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black h-24 resize-none outline-none focus:border-brand-orange" />
              <div className="flex items-center justify-between bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200">
                <div><span className="text-[10px] font-black uppercase tracking-widest">Disponível</span></div>
                <button type="button" onClick={() => setEditingProduct({...editingProduct, isAvailable: !editingProduct.isAvailable})} className={`w-14 h-7 rounded-full relative transition-all ${editingProduct?.isAvailable ? 'bg-brand-green' : 'bg-red-400'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${editingProduct?.isAvailable ? 'left-8' : 'left-1'}`}></div></button>
              </div>
              <button type="submit" className="w-full bg-brand-dark text-brand-orange py-6 rounded-2xl font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Salvar Item</button>
            </form>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-brand-dark/90 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 relative animate-in slide-in-from-bottom duration-300">
            <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full active:scale-90 transition-all"><CloseIcon size={20}/></button>
            <h3 className="text-xl font-black uppercase italic mb-8 tracking-widest text-brand-dark leading-none">Categorias</h3>
            <div className="flex gap-2 mb-6"><input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nova..." className="flex-1 bg-gray-50 border-2 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-brand-orange"/><button onClick={handleAddCategory} className="bg-brand-dark text-brand-orange px-4 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg">Add</button></div>
            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border shadow-sm"><span className="text-xs font-black uppercase">{cat.name}</span><button onClick={() => handleDeleteCategory(cat.name)} className="text-red-500 hover:scale-110 active:scale-90 transition-all"><TrashIcon size={18}/></button></div>))}</div>
          </div>
        </div>
      )}

      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 relative shadow-2xl animate-in zoom-in duration-300">
              <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full active:scale-90 transition-all"><CloseIcon size={20}/></button>
              <h3 className="text-xl font-black uppercase italic mb-8 tracking-widest text-brand-dark leading-none">Configurar Cupom</h3>
              <div className="space-y-4">
                 <input value={editingCoupon.code} onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value})} placeholder="CÓDIGO (EX: MARMITA10)" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-brand-orange" />
                 <input type="number" value={editingCoupon.percentage} onChange={e => setEditingCoupon({...editingCoupon, percentage: Number(e.target.value)})} placeholder="PERCENTUAL (%)" className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-xs font-black outline-none focus:border-brand-orange" />
                 <div className="space-y-2">
                   <p className="text-[9px] font-black uppercase text-gray-400 ml-2 tracking-widest">Escopo:</p>
                   <select value={editingCoupon.scopeType} onChange={e => setEditingCoupon({...editingCoupon, scopeType: e.target.value as any, scopeValue: ''})} className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-[10px] font-black uppercase outline-none">
                     <option value="all">Toda a Loja</option>
                     <option value="category">Categoria Específica</option>
                     <option value="product">Produto Específico</option>
                   </select>
                 </div>
                 {editingCoupon.scopeType !== 'all' && (
                    <div className="space-y-2 animate-in slide-in-from-top duration-300">
                       <p className="text-[9px] font-black uppercase text-gray-400 ml-2 tracking-widest">Válido para:</p>
                       {editingCoupon.scopeType === 'category' ? (
                         <select value={editingCoupon.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-[10px] font-black uppercase outline-none">
                           <option value="">Selecione a Categoria</option>
                           {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                       ) : (
                         <select value={editingCoupon.scopeValue} onChange={e => setEditingCoupon({...editingCoupon, scopeValue: e.target.value})} className="w-full bg-gray-50 border-2 rounded-xl px-5 py-4 text-[10px] font-black uppercase outline-none">
                           <option value="">Selecione o Produto</option>
                           {menuItems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                       )}
                    </div>
                 )}
                 <button onClick={handleSaveCoupon} className="w-full bg-brand-dark text-brand-orange py-5 rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Salvar Cupom</button>
              </div>
           </div>
        </div>
      )}

      {/* DETALHES DO PEDIDO (MODAL) */}
      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-md">
           <div className="relative bg-white w-full max-w-2xl h-[85vh] rounded-[3rem] p-10 overflow-y-auto flex flex-col border-t-8 border-brand-orange shadow-2xl animate-in zoom-in duration-300 no-scrollbar">
              <div className="flex justify-between items-start mb-6">
                 <div><h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-brand-dark leading-none">{selectedOrder.currentOrder?.customerName}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Pedido #{selectedOrder.currentOrder?.id}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => handlePrint(selectedOrder.currentOrder!)} className="bg-brand-dark text-brand-orange p-3 rounded-full hover:scale-110 shadow-lg transition-all"><PrinterIcon size={20}/></button>
                    <button onClick={() => setSelectedOrderId(null)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"><CloseIcon size={24}/></button>
                 </div>
              </div>
              <div className="flex-1 space-y-6">
                 <div className="bg-gray-50 p-6 rounded-[2rem] border">
                    <p className="text-[8px] font-black text-gray-400 mb-4 uppercase tracking-widest">Atualizar Status:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-brand-orange text-white border-brand-dark shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{STATUS_CFG[s].label}</button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase ml-2">Itens do Pedido:</p>
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm">
                          <img src={item.image} onError={e => e.currentTarget.src='https://placehold.co/100x100'} className="w-14 h-14 rounded-xl object-cover" />
                          <div className="flex-1"><p className="font-black text-[12px] uppercase leading-tight text-brand-dark">{item.name}</p><p className="text-[10px] font-bold text-gray-400">{item.quantity}x • R$ {item.price.toFixed(2)}</p></div>
                          <span className="font-black italic text-brand-orange text-[14px]">R$ {(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    ))}
                 </div>
                 {selectedOrder.currentOrder?.address && (
                   <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                     <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Endereço de Entrega:</p>
                     <p className="text-[11px] font-bold text-blue-900 leading-relaxed uppercase">{selectedOrder.currentOrder.address}</p>
                   </div>
                 )}
              </div>
              <div className="pt-8 mt-8 border-t flex justify-between items-center bg-white sticky bottom-0">
                 <div className="text-left"><p className="text-[10px] text-gray-400 font-black uppercase">Total</p><p className="text-4xl font-black italic tracking-tighter text-brand-dark">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p></div>
                 <button onClick={() => handleCompleteOrder(selectedOrder)} className="bg-brand-green text-white px-12 py-6 rounded-2xl font-black uppercase text-[11px] shadow-2xl hover:brightness-110 active:scale-95 transition-all">Concluir ✅</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
