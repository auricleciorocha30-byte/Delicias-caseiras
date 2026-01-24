
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

const STATUS_CFG: Record<string, any> = {
  'pending': { label: 'Pendente', color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200', badge: 'bg-orange-600 text-white' },
  'preparing': { label: 'Preparando', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', badge: 'bg-blue-600 text-white' },
  'ready': { label: 'Pronto', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200', badge: 'bg-green-600 text-white' },
  'delivered': { label: 'Entregue', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-400 text-white' }
};

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  tables = [], menuItems = [], categories = [], audioEnabled, onToggleAudio, onTestSound,
  onUpdateTable, onRefreshData, onLogout, onSaveProduct, onDeleteProduct, dbStatus, onAddToOrder,
  storeConfig, onUpdateStoreConfig
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'delivery' | 'menu' | 'marketing' | 'setup'>('tables');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loyaltySearch, setLoyaltySearch] = useState('');
  const [productSearchForTable, setProductSearchForTable] = useState('');
  const [currentObservation, setCurrentObservation] = useState('');
  const [isDataProcessing, setIsDataProcessing] = useState(false);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  
  const [newOrderForm, setNewOrderForm] = useState({ customerName: '', customerPhone: '', type: 'delivery' as 'delivery' | 'takeaway', address: '', paymentMethod: 'Pix' });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>({ isActive: false, spendingGoal: 100, scopeType: 'all', scopeValue: '' });
  const [loyaltyUsers, setLoyaltyUsers] = useState<LoyaltyUser[]>([]);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [couponForm, setCouponForm] = useState({ code: '', percentage: '', scopeType: 'all' as 'all' | 'category' | 'product', selectedItems: [] as string[] });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMarketing(); }, []);

  const fetchMarketing = async () => {
    try {
      const { data: cData } = await supabase.from('coupons').select('*').order('code', { ascending: true });
      if (cData) setCoupons(cData.map(c => ({ 
        id: c.id, 
        code: c.code, 
        percentage: c.percentage, 
        isActive: c.is_active, 
        scopeType: c.scope_type, 
        scopeValue: c.scope_value || '' 
      })));
      
      const { data: lConfig } = await supabase.from('loyalty_config').select('*').maybeSingle();
      if (lConfig) {
        setLoyalty({ 
          isActive: lConfig.is_active ?? false, 
          spendingGoal: lConfig.spending_goal ?? 100, 
          scopeType: lConfig.scope_type || 'all', 
          scopeValue: lConfig.scope_value || '' 
        });
      }
      
      const { data: lUsers } = await supabase.from('loyalty_users').select('*').order('accumulated', { ascending: false });
      if (lUsers) setLoyaltyUsers(lUsers);
    } catch (e) { console.error("Error fetching marketing data", e); }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = couponForm.code.toUpperCase().trim();
    if (!cleanCode || !couponForm.percentage) return;
    
    setIsDataProcessing(true);
    const scopeValue = couponForm.scopeType === 'all' ? '' : couponForm.selectedItems.join(',');
    const couponData = { 
      code: cleanCode, 
      percentage: Number(couponForm.percentage), 
      is_active: true, 
      scope_type: couponForm.scopeType, 
      scope_value: scopeValue
    };

    try {
      let error;
      if (editingCoupon?.id) {
        const { error: err } = await supabase.from('coupons').update(couponData).eq('id', editingCoupon.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('coupons').insert([{ id: 'c_'+Date.now(), ...couponData }]); 
        error = err;
      }
      
      if (error) throw error;
      
      setIsCouponModalOpen(false);
      fetchMarketing();
      alert('Cupom salvo com sucesso!');
    } catch (err: any) {
      console.error("Erro ao salvar cupom:", err);
      alert(`Erro ao salvar cupom: ${err.message}`);
    } finally {
      setIsDataProcessing(false);
    }
  };

  const startEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      percentage: coupon.percentage.toString(),
      scopeType: coupon.scopeType,
      selectedItems: coupon.scopeValue ? coupon.scopeValue.split(',').filter(Boolean) : []
    });
    setIsCouponModalOpen(true);
  };

  const handleDeleteLoyaltyUser = async (phone: string) => {
    if (!confirm('Deseja realmente remover este participante do ranking de fidelidade? Esta ação não pode ser desfeita.')) return;
    
    try {
      const { error } = await supabase.from('loyalty_users').delete().eq('phone', phone);
      if (error) throw error;
      fetchMarketing();
    } catch (err) {
      console.error("Erro ao deletar usuário fidelidade:", err);
      alert('Erro ao remover participante.');
    }
  };

  const handleExportBackup = async () => {
    setIsDataProcessing(true);
    try {
      const [products, categories, coupons, loyalty, store] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('coupons').select('*'),
        supabase.from('loyalty_config').select('*'),
        supabase.from('store_config').select('*')
      ]);

      const backupData = {
        storeName: STORE_INFO.name,
        timestamp: new Date().toISOString(),
        data: {
          products: products.data || [],
          categories: categories.data || [],
          coupons: coupons.data || [],
          loyalty_config: loyalty.data || [],
          store_config: store.data || []
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_delicias_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Erro ao gerar backup!");
    } finally {
      setIsDataProcessing(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("Isso irá sobrescrever seus produtos e configurações atuais. Deseja continuar?")) {
      event.target.value = '';
      return;
    }

    setIsDataProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (!content.data) throw new Error("Formato inválido");

        const d = content.data;
        if (d.categories?.length) await supabase.from('categories').upsert(d.categories);
        if (d.products?.length) await supabase.from('products').upsert(d.products);
        if (d.coupons?.length) await supabase.from('coupons').upsert(d.coupons);
        if (d.loyalty_config?.length) await supabase.from('loyalty_config').upsert(d.loyalty_config);
        if (d.store_config?.length) await supabase.from('store_config').upsert(d.store_config);

        alert("Restauração concluída com sucesso! Recarregando dados...");
        onRefreshData();
      } catch (err) {
        alert("Erro ao restaurar: Arquivo inválido.");
      } finally {
        setIsDataProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
    fetchMarketing();
  };

  const toggleLoyaltyItem = (val: string) => {
    const currentItems = loyalty.scopeValue ? loyalty.scopeValue.split(',').filter(Boolean) : [];
    const nextItems = currentItems.includes(val) ? currentItems.filter(i => i !== val) : [...currentItems, val];
    handleUpdateLoyalty({ scopeValue: nextItems.join(',') });
  };

  const toggleCouponItem = (val: string) => {
    setCouponForm(prev => {
      const items = prev.selectedItems.includes(val) ? prev.selectedItems.filter(i => i !== val) : [...prev.selectedItems, val];
      return { ...prev, selectedItems: items };
    });
  };

  const handleUpdateTableStatus = async (tableId: number, newStatus: OrderStatus) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || !table.currentOrder) return;
    const updatedOrder = { ...table.currentOrder, status: newStatus, isUpdated: true, items: [...table.currentOrder.items] };
    await onUpdateTable(tableId, 'occupied', updatedOrder);
  };

  const filteredLoyaltyUsers = useMemo(() => {
    return (loyaltyUsers || []).filter(u => 
      (u.name?.toLowerCase() || "").includes(loyaltySearch.toLowerCase()) || 
      (u.phone || "").includes(loyaltySearch)
    );
  }, [loyaltyUsers, loyaltySearch]);

  const physicalTables = tables.filter(t => t.id <= 12).sort((a,b) => a.id - b.id);
  const activeDeliveries = tables.filter(t => t.id >= 900 && t.id <= 999 && t.status === 'occupied');
  const selectedTable = tables.find(t => t.id === selectedTableId) || null;
  const filteredMenu = (menuItems || []).filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const loyaltyScopeItems = useMemo(() => {
    return (loyalty.scopeValue || "").split(',').filter(Boolean);
  }, [loyalty.scopeValue]);

  const filteredProductsForTable = useMemo(() => {
    if (!productSearchForTable.trim()) return menuItems.filter(p => p.isAvailable).slice(0, 8);
    return menuItems.filter(p => 
      p.isAvailable && 
      (p.name.toLowerCase().includes(productSearchForTable.toLowerCase()) || 
       p.category.toLowerCase().includes(productSearchForTable.toLowerCase()))
    );
  }, [menuItems, productSearchForTable]);

  // Fila para o operador ver o que está no painel
  const statusQueue = useMemo(() => {
    return tables
      .filter(t => t.status === 'occupied' && t.currentOrder && t.currentOrder.status !== 'delivered' && (t.id <= 12 || t.id >= 950))
      .map(t => t.currentOrder!)
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tables]);

  return (
    <div className="w-full">
      <div className="bg-gray-800 p-5 rounded-[2.5rem] shadow-2xl mb-8 border-b-4 border-orange-500 flex flex-col md:flex-row justify-between items-center gap-5">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-black italic text-orange-500 uppercase leading-none">{STORE_INFO.name}</h2>
            <p className="text-[8px] text-gray-500 uppercase font-black mt-1 tracking-widest">SISTEMA ADMIN</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-700">
            <span className={`h-2 w-2 rounded-full ${dbStatus === 'ok' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></span>
            <span className="text-[8px] font-black uppercase text-white tracking-widest">{dbStatus === 'ok' ? 'Online' : 'Sinc...'}</span>
          </div>
        </div>

        <nav className="flex bg-gray-900 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar max-w-full">
          {(['tables', 'delivery', 'menu', 'marketing', 'setup'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab ? 'bg-orange-500 text-white shadow-lg scale-105' : 'text-gray-500 hover:text-white'}`}>
              {tab === 'tables' ? 'Mesas' : tab === 'delivery' ? 'Externo' : tab === 'menu' ? 'Menu' : tab === 'marketing' ? 'Mkt' : 'Setup'}
            </button>
          ))}
        </nav>
        
        <div className="flex gap-3 items-center">
          <button onClick={onToggleAudio} className={`p-3 rounded-full transition-all ${audioEnabled ? 'bg-orange-500 text-white shadow-lg ring-4 ring-orange-500/20' : 'bg-gray-700 text-gray-500'}`}>
            <VolumeIcon muted={!audioEnabled} size={18}/>
          </button>
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-5 py-3 rounded-xl active:scale-95 shadow-lg transition-all">Sair</button>
        </div>
      </div>

      <div className="animate-in fade-in duration-500">
        {activeTab === 'setup' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100">
              <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">Serviços Ativos</h3>
              <div className="space-y-4">
                {[
                  { key: 'tablesEnabled', label: 'Atendimento Mesas', icon: '🪑' },
                  { key: 'deliveryEnabled', label: 'Serviço Entrega', icon: '🚚' },
                  { key: 'counterEnabled', label: 'Retirada Balcão', icon: '🏪' },
                  { key: 'statusPanelEnabled', label: 'Painel Status Público', icon: '📺' }
                ].map(opt => (
                  <div key={opt.key} className="flex items-center justify-between p-5 bg-gray-50 rounded-[2rem] border border-gray-100">
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{opt.icon}</span>
                      <span className="font-black text-[10px] uppercase tracking-wider">{opt.label}</span>
                    </div>
                    <button 
                      onClick={() => onUpdateStoreConfig({ ...storeConfig, [opt.key]: !storeConfig[opt.key as keyof StoreConfig] })}
                      className={`w-14 h-7 rounded-full transition-all relative ${storeConfig[opt.key as keyof StoreConfig] ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${storeConfig[opt.key as keyof StoreConfig] ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col">
              <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter text-gray-400">Dados do Sistema</h3>
              <div className="space-y-4 flex-1">
                <button 
                  onClick={handleExportBackup}
                  disabled={isDataProcessing}
                  className="w-full p-6 bg-gray-800 text-orange-500 rounded-[2rem] flex items-center justify-between hover:scale-[1.02] transition-all active:scale-95 shadow-xl disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="font-black text-sm uppercase leading-none mb-1">Fazer Backup</p>
                    <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Salvar catálogo e configurações</p>
                  </div>
                  <BackupIcon size={24} />
                </button>

                <div className="relative">
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportBackup} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isDataProcessing} className="w-full p-6 bg-gray-100 text-black border-2 border-dashed border-gray-300 rounded-[2rem] flex items-center justify-between hover:border-black transition-all active:scale-95 disabled:opacity-50">
                    <div className="text-left">
                      <p className="font-black text-sm uppercase leading-none mb-1">Restaurar</p>
                      <p className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">Carregar arquivo de backup</p>
                    </div>
                    <RestoreIcon size={24} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'tables' || activeTab === 'delivery') && storeConfig.statusPanelEnabled && statusQueue.length > 0 && (
          <div className="mb-10 bg-gray-800 p-6 rounded-[2.5rem] border-4 border-orange-500 overflow-hidden">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase text-orange-500 tracking-widest">👁️ Fila do Painel Público (Ao Vivo)</h3>
                <span className="text-[8px] font-black uppercase text-white/40">{statusQueue.length} Pedidos Visíveis</span>
             </div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar">
                {statusQueue.map(order => (
                  <div key={order.id} className={`shrink-0 w-40 p-3 rounded-2xl border-2 ${order.status === 'ready' ? 'bg-green-600 border-white animate-pulse' : 'bg-gray-900 border-gray-700'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[7px] font-black uppercase opacity-60">#{order.id}</span>
                      <span className="text-[6px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10">{STATUS_CFG[order.status].label}</span>
                    </div>
                    <p className="font-black text-[10px] uppercase truncate text-white">{order.customerName}</p>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {physicalTables.map(t => (
              <button key={t.id} onClick={() => setSelectedTableId(t.id)} className={`h-40 p-5 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-1 relative ${t.status === 'free' ? 'bg-white border-gray-100' : 'bg-orange-500 border-gray-800 shadow-xl'}`}>
                {t.currentOrder?.status === 'pending' && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[7px] font-black px-2 py-1 rounded-lg animate-bounce border-2 border-white shadow-md"></span>}
                <span className={`text-4xl font-black italic leading-none ${t.status === 'free' ? 'text-gray-800' : 'text-white'}`}>{t.id}</span>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${t.status === 'free' ? 'bg-gray-100 text-gray-400' : STATUS_CFG[t.currentOrder?.status || 'pending'].badge}`}>
                  {t.status === 'free' ? 'Livre' : STATUS_CFG[t.currentOrder?.status || 'pending'].label}
                </span>
                {t.currentOrder && <span className="text-[10px] font-black text-white uppercase truncate w-full text-center px-2 mt-1">{t.currentOrder.customerName}</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border shadow-sm">
              <h3 className="text-lg font-black italic uppercase text-gray-400">Entrega e Balcão</h3>
              <button onClick={() => setIsNewOrderModalOpen(true)} className="bg-gray-800 text-orange-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">+ Novo Pedido</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {activeDeliveries.map(t => (
                <button key={t.id} onClick={() => setSelectedTableId(t.id)} className={`bg-white border-4 p-5 rounded-[2.5rem] text-left relative overflow-hidden group shadow-md transition-all active:scale-[0.98] ${t.currentOrder?.status === 'pending' ? 'border-red-500 animate-pulse' : t.id >= 950 ? 'border-purple-400' : 'border-orange-500'}`}>
                  <div className={`absolute top-0 right-0 px-3 py-1.5 text-[8px] font-black uppercase ${t.id >= 950 ? 'bg-purple-600 text-white' : 'bg-orange-600 text-white'}`}>{t.id >= 950 ? 'Balcão' : 'Entrega'}</div>
                  <div className="flex justify-between items-center mb-3 mt-1"><span className="text-xl group-hover:scale-110 transition-transform">{t.id >= 950 ? '🏪' : '🚚'}</span><span className="text-[9px] font-black text-gray-400 uppercase">#{t.currentOrder?.id || t.id}</span></div>
                  <h4 className="font-black text-xs uppercase truncate mb-1">{t.currentOrder?.customerName}</h4>
                  
                  {/* ENDEREÇO EM DESTAQUE NO CARD */}
                  {t.currentOrder?.address && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[8px] text-gray-400 font-black uppercase mb-0.5">Endereço:</p>
                      <p className="text-[9px] text-gray-700 font-bold uppercase truncate">{t.currentOrder.address}</p>
                    </div>
                  )}
                  
                  <div className={`${STATUS_CFG[t.currentOrder?.status || 'pending'].badge} text-[8px] font-black px-3 py-1.5 rounded-full inline-block uppercase tracking-wider`}>{STATUS_CFG[t.currentOrder?.status || 'pending'].label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black italic uppercase">Categorias</h3>
                <button onClick={() => { setNewCategoryName(''); setIsCategoryModalOpen(true); }} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all">+ Nova</button>
              </div>
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-gray-50 px-5 py-3 rounded-xl border flex items-center gap-3 group">
                    <span className="font-black text-[10px] uppercase tracking-wider">{cat.name}</span>
                    <button onClick={async () => { if(confirm('Excluir?')) { await supabase.from('categories').delete().eq('id', cat.id); onRefreshData(); } }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h3 className="text-2xl font-black italic uppercase">Produtos</h3>
                <div className="flex gap-4 w-full md:w-auto">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="flex-1 md:w-64 bg-gray-50 border-2 rounded-xl px-4 py-3 text-[10px] font-black outline-none focus:border-orange-500" />
                  <button onClick={() => { setEditingProduct({ name: '', price: '', category: categories[0]?.name || '', image: '', isAvailable: true }); setIsProductModalOpen(true); }} className="bg-gray-800 text-orange-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-xl">+ Novo</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-[2.5rem] border hover:border-orange-500 transition-all">
                    <img src={item.image} className="w-full aspect-square object-cover rounded-2xl mb-4" />
                    <h4 className="font-black text-[10px] uppercase truncate mb-2">{item.name}</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-orange-600 font-black italic text-xs">R$ {(item.price || 0).toFixed(2)}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="p-2 bg-white text-blue-500 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"><EditIcon size={14}/></button>
                        <button onClick={() => onDeleteProduct(item.id)} className="p-2 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50 transition-colors"><TrashIcon size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'marketing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col h-auto min-h-[600px]">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h3 className="text-xl font-black italic uppercase">💎 Ranking de Fidelidade</h3>
                <div className="flex gap-4 items-center">
                  <input type="text" value={loyaltySearch} onChange={e => setLoyaltySearch(e.target.value)} placeholder="BUSCAR..." className="bg-gray-50 border-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-orange-500 transition-all" />
                  <button onClick={() => handleUpdateLoyalty({ isActive: !loyalty.isActive })} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${loyalty.isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {loyalty.isActive ? 'Ativo' : 'Pausado'}
                  </button>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-[2rem] border-2 border-orange-100 mb-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-orange-800">Meta R$</p>
                    <input type="number" value={loyalty.spendingGoal} onChange={e => handleUpdateLoyalty({ spendingGoal: Number(e.target.value) })} className="w-full bg-white p-4 rounded-xl border-2 border-orange-200 font-black text-sm outline-none" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-orange-800">Tipo de Pontuação</p>
                    <select value={loyalty.scopeType} onChange={e => handleUpdateLoyalty({ scopeType: e.target.value as any, scopeValue: '' })} className="w-full bg-white p-4 rounded-xl border-2 border-orange-200 font-black text-[9px] uppercase outline-none">
                      <option value="all">Loja Toda</option>
                      <option value="category">Por Categorias</option>
                      <option value="product">Por Produtos</option>
                    </select>
                  </div>
                </div>
                {loyalty.scopeType !== 'all' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto no-scrollbar p-2 bg-white/50 rounded-xl border border-orange-100/50">
                    {loyalty.scopeType === 'category' ? categories?.map(cat => (
                      <button key={cat.id} onClick={() => toggleLoyaltyItem(cat.name)} className={`p-2 rounded-lg border-2 text-[8px] font-black uppercase transition-all ${loyaltyScopeItems.includes(cat.name) ? 'bg-orange-500 text-white border-gray-800 shadow-sm' : 'bg-white border-transparent text-gray-400 hover:border-gray-200'}`}>
                        {cat.name}
                      </button>
                    )) : menuItems?.map(prod => (
                      <button key={prod.id} onClick={() => toggleLoyaltyItem(prod.id)} className={`p-2 rounded-lg border-2 text-[8px] font-black uppercase transition-all ${loyaltyScopeItems.includes(prod.id) ? 'bg-orange-500 text-white border-gray-800 shadow-sm' : 'bg-white border-transparent text-gray-400 hover:border-gray-200'}`}>
                        {prod.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                {filteredLoyaltyUsers.length > 0 ? filteredLoyaltyUsers.map((u, i) => {
                  const progress = Math.min(100, (u.accumulated / (loyalty.spendingGoal || 1)) * 100);
                  return (
                    <div key={u.phone} className={`flex items-center gap-4 p-4 rounded-2xl border ${i < 3 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-transparent'} group`}>
                      <span className="text-xl shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-end mb-1">
                          <p className="font-black text-[10px] uppercase truncate pr-2">{u.name || "Sem Nome"} <span className="text-[8px] text-gray-400 font-bold ml-1">({u.phone})</span></p>
                          <p className="text-orange-700 font-black italic text-xs shrink-0">R$ {(u.accumulated || 0).toFixed(2)}</p>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${progress >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteLoyaltyUser(u.phone)} 
                        className="p-2.5 bg-white text-red-500 rounded-xl shadow-sm border border-transparent hover:border-red-200 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        title="Remover Participante"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  );
                }) : <div className="text-center py-10 text-gray-400 font-black uppercase text-[10px]">Nenhum cliente fidelizado encontrado</div>}
              </div>
            </div>

            <div className="lg:col-span-1 bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col h-auto min-h-[600px]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black italic uppercase">🎫 Cupons</h3>
                <button onClick={() => { setEditingCoupon(null); setCouponForm({ code: '', percentage: '', scopeType: 'all', selectedItems: [] }); setIsCouponModalOpen(true); }} className="bg-gray-800 text-orange-500 px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-all">+ Novo</button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                {coupons.length > 0 ? coupons.map(c => (
                  <div key={c.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-gray-800 text-orange-500 px-3 py-1 rounded-lg font-black text-[10px] tracking-widest">{c.code}</span>
                      <span className="text-green-600 font-black text-xs">{c.percentage}% OFF</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${c.isActive ? 'text-green-500 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>{c.isActive ? 'Ativo' : 'Pausado'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => startEditCoupon(c)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-orange-50 transition-colors"><EditIcon size={14} /></button>
                        <button onClick={async () => { await supabase.from('coupons').update({ is_active: !c.isActive }).eq('id', c.id); fetchMarketing(); }} className="p-2 bg-white rounded-lg shadow-sm hover:bg-orange-50 transition-colors"><VolumeIcon size={14} muted={!c.isActive} /></button>
                        <button onClick={async () => { if(confirm('Excluir cupom?')) { await supabase.from('coupons').delete().eq('id', c.id); fetchMarketing(); } }} className="p-2 bg-white rounded-lg shadow-sm text-red-500 hover:bg-red-50 transition-colors"><TrashIcon size={14} /></button>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-center py-10 text-gray-400 font-black uppercase text-[10px]">Nenhum cupom cadastrado</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHES PEDIDO DA MESA */}
      {selectedTable && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => { setSelectedTableId(null); setProductSearchForTable(''); setCurrentObservation(''); }} />
          <div className="relative bg-white w-full max-w-7xl h-[92vh] rounded-[3rem] flex flex-col overflow-hidden shadow-2xl border-t-8 border-orange-500 animate-in zoom-in duration-300">
            {/* Header Fixo */}
            <div className="p-6 border-b flex justify-between items-center bg-white shadow-sm sticky top-0 z-50 shrink-0">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-black">
                  {selectedTable.id >= 950 ? 'Balcão' : selectedTable.id >= 900 ? 'Entrega' : `Mesa ${selectedTable.id}`}
                </h3>
                <p className="text-[10px] font-black text-gray-400 uppercase mt-2">
                  ID: #{selectedTable.currentOrder?.id} • <span className={STATUS_CFG[selectedTable.currentOrder?.status || 'pending'].color}>{STATUS_CFG[selectedTable.currentOrder?.status || 'pending'].label}</span>
                </p>
              </div>
              <button onClick={() => { setSelectedTableId(null); setProductSearchForTable(''); setCurrentObservation(''); }} className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={20}/></button>
            </div>
            
            {/* Conteúdo com Scroll Unificado para Mobile / Separado para Desktop */}
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0 bg-gray-50">
               
               {/* Coluna 1: Status e Ações */}
               <div className="w-full md:w-64 bg-gray-50 p-6 md:border-r md:overflow-y-auto shrink-0 border-b md:border-b-0">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Mudar Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-2 mb-8">
                    {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                      <button key={s} onClick={() => handleUpdateTableStatus(selectedTable.id, s)} className={`py-4 rounded-xl text-[9px] font-black uppercase border-2 transition-all active:scale-95 ${selectedTable.currentOrder?.status === s ? 'bg-gray-800 text-white border-gray-800 shadow-lg' : 'bg-white text-gray-400 border-gray-100 hover:border-orange-500'}`}>{STATUS_CFG[s].label}</button>
                    ))}
                  </div>
                  
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Ações do Pedido</h4>
                  <div className="space-y-2">
                    <button onClick={() => { if(confirm('Finalizar e liberar mesa?')) { onUpdateTable(selectedTable.id, 'free'); setSelectedTableId(null); } }} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:brightness-110 active:scale-95 transition-all">Finalizar e Liberar 🏁</button>
                    <button className="w-full bg-white text-black border-2 border-gray-800 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-gray-800 hover:text-white transition-all flex items-center justify-center gap-2"><PrinterIcon size={16}/> Imprimir Via</button>
                  </div>
               </div>

               {/* Coluna 2: Itens Atuais e Total */}
               <div className="flex-1 p-6 md:overflow-y-auto space-y-6 bg-white border-b md:border-b-0 min-w-0">
                  <div className="bg-orange-50 p-6 rounded-[2.5rem] border-2 border-orange-100 shadow-sm md:sticky md:top-0 md:z-20">
                    <div className="flex justify-between items-start text-black">
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-[8px] font-black text-orange-700 uppercase tracking-widest">Cliente</p>
                        <p className="font-black text-lg uppercase tracking-tight truncate mb-2">{selectedTable.currentOrder?.customerName}</p>
                        
                        {/* ENDEREÇO EM DESTAQUE NO MODAL */}
                        {selectedTable.currentOrder?.address && (
                          <div className="bg-gray-800 p-5 rounded-[2rem] border-4 border-orange-500 shadow-xl">
                             <div className="flex justify-between items-center mb-1">
                                <p className="text-[7px] font-black text-orange-500 uppercase tracking-[0.2em]">Endereço de Entrega</p>
                                <button onClick={() => navigator.clipboard.writeText(selectedTable.currentOrder?.address || '')} className="text-[7px] font-black text-white bg-white/10 px-2 py-1 rounded uppercase">Copiar</button>
                             </div>
                             <p className="text-sm font-black text-white leading-tight uppercase italic">{selectedTable.currentOrder.address}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-[8px] font-black text-orange-700 uppercase tracking-widest">A Pagar</p>
                        <p className="text-3xl font-black italic text-black">R$ {(selectedTable.currentOrder?.finalTotal || 0).toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Itens Solicitados</h4>
                    {selectedTable.currentOrder?.items.map((item, i) => (
                      <div key={i} className="flex flex-col gap-2 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="flex gap-4 items-center">
                          <img src={item.image} className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black uppercase leading-none truncate">{item.name}</h4>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 truncate">{item.category}</p>
                          </div>
                          <div className="text-right font-black shrink-0">
                            <p className="text-[10px] text-gray-400">{item.quantity}x</p>
                            <p className="text-sm italic">R$ {(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                        {item.observation && (
                          <div className="mt-2 bg-orange-50 px-4 py-2 rounded-xl text-[9px] font-bold text-orange-800 border-l-4 border-orange-500">
                             Obs: {item.observation}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!selectedTable.currentOrder?.items || selectedTable.currentOrder.items.length === 0) && (
                      <div className="text-center py-12 text-gray-300 font-black uppercase text-[10px]">Mesa sem itens no momento</div>
                    )}
                  </div>
               </div>

               {/* Coluna 3: Adicionar Itens (Busca e Adição) */}
               <div className="w-full md:w-80 lg:w-96 bg-gray-50 p-6 md:border-l md:overflow-y-auto shrink-0 shadow-[inset_10px_0_15px_-10px_rgba(0,0,0,0.05)]">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Adicionar ao Pedido</h4>
                  <div className="space-y-4 mb-6">
                    <input type="text" value={productSearchForTable} onChange={e => setProductSearchForTable(e.target.value)} placeholder="BUSCAR PRODUTO..." className="w-full bg-white border-2 rounded-2xl px-5 py-3 text-[10px] font-black outline-none uppercase focus:border-orange-500 transition-all shadow-sm" />
                    <textarea value={currentObservation} onChange={e => setCurrentObservation(e.target.value)} placeholder="OBSERVAÇÃO OPCIONAL..." className="w-full bg-white border-2 rounded-2xl px-5 py-3 text-[9px] font-black outline-none uppercase h-20 resize-none focus:border-orange-500 transition-all shadow-sm" />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 pb-10">
                    {filteredProductsForTable.map(p => (
                      <button key={p.id} onClick={() => { onAddToOrder(selectedTable.id, p, currentObservation); setCurrentObservation(''); }} className="w-full bg-white p-3 rounded-2xl border border-gray-100 flex gap-3 items-center hover:border-black transition-all active:scale-[0.98] shadow-sm group">
                        <img src={p.image} className="w-10 h-10 rounded-lg object-cover shadow-xs" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-[9px] font-black uppercase leading-none truncate mb-1">{p.name}</p>
                          <p className="text-[8px] font-black text-orange-700 italic">R$ {p.price.toFixed(2)}</p>
                        </div>
                        <span className="bg-orange-500 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-lg shrink-0 shadow-sm group-hover:bg-gray-800 group-hover:text-orange-500 transition-colors">+</span>
                      </button>
                    ))}
                    {filteredProductsForTable.length === 0 && (
                      <p className="text-center py-4 text-[9px] text-gray-400 font-black uppercase">Nenhum produto encontrado</p>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PEDIDO EXTERNO */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 relative shadow-2xl">
             <button onClick={() => setIsNewOrderModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-8 uppercase tracking-tighter">Lançar Pedido</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               const range = newOrderForm.type === 'delivery' ? [900, 949] : [950, 999];
               const free = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free');
               if (!free) return alert('Sem vagas disponíveis.');
               const newOrder: Order = {
                 id: Math.random().toString(36).substr(2, 6).toUpperCase(), customerName: newOrderForm.customerName, items: [], total: 0, finalTotal: 0, paymentMethod: newOrderForm.paymentMethod, timestamp: new Date().toISOString(), tableId: free.id, status: 'pending', orderType: newOrderForm.type === 'takeaway' ? 'counter' : 'delivery', address: newOrderForm.type === 'delivery' ? newOrderForm.address : undefined
               };
               await onUpdateTable(free.id, 'occupied', newOrder);
               setIsNewOrderModalOpen(false);
               setSelectedTableId(free.id);
             }} className="space-y-4">
                <input type="text" value={newOrderForm.customerName} onChange={e => setNewOrderForm({...newOrderForm, customerName: e.target.value})} placeholder="NOME DO CLIENTE" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none uppercase focus:border-orange-500 transition-all" required />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewOrderForm({...newOrderForm, type: 'delivery'})} className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${newOrderForm.type === 'delivery' ? 'bg-gray-800 text-white' : 'bg-white text-gray-400'}`}>Entrega</button>
                  <button type="button" onClick={() => setNewOrderForm({...newOrderForm, type: 'takeaway'})} className={`py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${newOrderForm.type === 'takeaway' ? 'bg-gray-800 text-white' : 'bg-white text-gray-400'}`}>Balcão</button>
                </div>
                {newOrderForm.type === 'delivery' && (
                  <textarea value={newOrderForm.address} onChange={e => setNewOrderForm({...newOrderForm, address: e.target.value})} placeholder="ENDEREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none h-24 resize-none focus:border-orange-500 transition-all" required />
                )}
                <button type="submit" className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:brightness-110 transition-all">Criar Pedido</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA CATEGORIA */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 relative shadow-2xl">
             <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-8 uppercase tracking-tighter">Nova Categoria</h3>
             <form onSubmit={async (e) => {
               e.preventDefault();
               if (!newCategoryName) return;
               await supabase.from('categories').insert([{ id: 'cat_' + Date.now(), name: newCategoryName }]);
               setNewCategoryName('');
               setIsCategoryModalOpen(false);
               onRefreshData();
             }} className="space-y-6">
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="NOME DA CATEGORIA" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none uppercase focus:border-orange-500 transition-all" required />
                <button type="submit" className="w-full bg-gray-800 text-orange-500 py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:brightness-125 transition-all">Criar Categoria</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO/EDITAR PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/98 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
             <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-8 uppercase tracking-tighter">{editingProduct?.id ? 'Editar' : 'Novo'} Item</h3>
             <form onSubmit={(e) => { e.preventDefault(); onSaveProduct({ ...editingProduct, price: parseFloat(editingProduct?.price || 0) }); setIsProductModalOpen(false); }} className="space-y-6">
                <input type="text" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME DO PRODUTO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none uppercase focus:border-orange-500 transition-all" required />
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} placeholder="PREÇO R$" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-orange-500 transition-all" required />
                    <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black outline-none uppercase focus:border-orange-500 transition-all">
                      <option value="">CATEGORIA</option>
                      {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </select>
                </div>
                <input type="text" value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="LINK DA IMAGEM (URL)" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black outline-none focus:border-orange-500 transition-all" />
                <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO / INGREDIENTES" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[10px] font-black outline-none h-24 resize-none focus:border-orange-500 transition-all" />
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl">
                   <input type="checkbox" checked={editingProduct?.isAvailable ?? true} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-5 h-5 rounded-md accent-orange-500" id="avail_check" />
                   <label htmlFor="avail_check" className="font-black text-[10px] uppercase cursor-pointer">Disponível no Cardápio</label>
                </div>
                <button type="submit" className="w-full bg-gray-800 text-orange-500 py-6 rounded-2xl font-black text-sm uppercase shadow-2xl active:scale-95 transition-all hover:brightness-125">Salvar Alterações</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL CUPOM */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <button onClick={() => setIsCouponModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={20}/></button>
            <h3 className="text-2xl font-black italic mb-8 uppercase tracking-tighter">{editingCoupon ? 'Editar' : 'Novo'} Cupom</h3>
            <form onSubmit={handleSaveCoupon} className="space-y-6 overflow-y-auto no-scrollbar">
              <input value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value})} placeholder="CÓDIGO (EX: NATAL10)" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none uppercase focus:border-orange-500 transition-all" required />
              <input type="number" value={couponForm.percentage} onChange={e => setCouponForm({...couponForm, percentage: e.target.value})} placeholder="DESCONTO %" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black outline-none focus:border-orange-500 transition-all" required />
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                {(['all', 'category', 'product'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setCouponForm({...couponForm, scopeType: s, selectedItems: []})} className={`flex-1 py-3 rounded-lg text-[8px] font-black uppercase transition-all ${couponForm.scopeType === s ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-black'}`}>{s === 'all' ? 'Tudo' : s === 'category' ? 'Cats' : 'Prods'}</button>
                ))}
              </div>
              {couponForm.scopeType !== 'all' && (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar p-2 bg-gray-50 rounded-xl">
                  {couponForm.scopeType === 'category' ? categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => toggleCouponItem(cat.name)} className={`p-2 rounded-lg border-2 text-[8px] font-black uppercase transition-all ${couponForm.selectedItems.includes(cat.name) ? 'bg-orange-500 text-white border-gray-800 shadow-sm' : 'bg-white border-transparent hover:border-gray-300'}`}>{cat.name}</button>
                  )) : menuItems.map(prod => (
                    <button key={prod.id} type="button" onClick={() => toggleCouponItem(prod.id)} className={`p-2 rounded-lg border-2 text-[8px] font-black uppercase transition-all ${couponForm.selectedItems.includes(prod.id) ? 'bg-orange-500 text-white border-gray-800 shadow-sm' : 'bg-white border-transparent hover:border-gray-300'}`}>{prod.name}</button>
                  ))}
                </div>
              )}
              <button type="submit" disabled={isDataProcessing} className="w-full bg-gray-800 text-orange-500 py-6 rounded-2xl font-black text-sm uppercase shadow-xl hover:brightness-125 transition-all disabled:opacity-50">
                {isDataProcessing ? 'Salvando...' : 'Salvar Cupom'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
