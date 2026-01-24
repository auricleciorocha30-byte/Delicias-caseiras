
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import HeaderComp from './components/Header';
import MenuItem from './components/MenuItem';
import Cart from './components/Cart';
import AdminPanel from './components/AdminPanel';
import { MENU_ITEMS as STATIC_MENU, INITIAL_TABLES, STORE_INFO } from './constants';
import { Product, CartItem, Table, Order, Category, Coupon, StoreConfig } from './types';
import { supabase } from './lib/supabase';
import { CloseIcon } from './components/Icons';

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok' | 'error' | 'syncing'>('loading');
  const [activeAlert, setActiveAlert] = useState<{ id: number; type: string; msg: string; isUpdate?: boolean; timestamp: number } | null>(null);
  
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    tablesEnabled: true,
    deliveryEnabled: true,
    counterEnabled: true,
    statusPanelEnabled: false
  });

  const isStoreClosed = useMemo(() => {
    return !storeConfig.tablesEnabled && !storeConfig.deliveryEnabled && !storeConfig.counterEnabled;
  }, [storeConfig]);

  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedOrderId = useRef<string | null>(null);

  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    notificationSound.current.load();
  }, []);

  const handleUnlockAudio = useCallback(() => {
    if (!audioUnlocked && notificationSound.current) {
      notificationSound.current.play().then(() => {
        notificationSound.current?.pause();
        setAudioUnlocked(true);
      }).catch(() => {});
    }
  }, [audioUnlocked]);

  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setDbStatus('loading');
      const [catRes, coupRes, prodRes, tableRes, configRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('coupons').select('*').eq('is_active', true),
        supabase.from('products').select('*').order('name'),
        supabase.from('tables').select('*').order('id'),
        supabase.from('store_config').select('*').maybeSingle()
      ]);

      if (configRes.data) {
        setStoreConfig({
          tablesEnabled: configRes.data.tables_enabled ?? true,
          deliveryEnabled: configRes.data.delivery_enabled ?? true,
          counterEnabled: configRes.data.counter_enabled ?? true,
          statusPanelEnabled: configRes.data.status_panel_enabled ?? false
        });
      }

      if (catRes.data) setCategories(catRes.data);
      if (coupRes.data) setActiveCoupons(coupRes.data.map((c: any) => ({ id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, scopeType: c.scope_type, scopeValue: c.scope_value })));
      if (prodRes.data && prodRes.data.length > 0) {
        setMenuItems(prodRes.data.map((p: any) => ({ id: p.id, name: p.name, description: p.description || '', price: Number(p.price), category: p.category, image: p.image, isAvailable: p.is_available ?? true })));
      } else setMenuItems(STATIC_MENU);
      
      if (tableRes.data) {
        setTables(prev => {
          const merged = [...INITIAL_TABLES];
          tableRes.data?.forEach((dbT: any) => {
            const idx = merged.findIndex(t => t.id === dbT.id);
            // Fix: Changed 'current_order' to 'currentOrder' to match the 'Table' interface
            if (idx >= 0) merged[idx] = { id: dbT.id, status: dbT.status, currentOrder: dbT.current_order };
          });
          return merged;
        });
      }
      setDbStatus('ok');
    } catch (err) { setDbStatus('error'); }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setIsLoggedIn(true); setIsAdmin(true); }
      fetchData();
    };
    checkSession();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase.channel('delicias_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
        const newRec = payload.new as any;
        if (!newRec) return;
        // Fix: Changed 'current_order' to 'currentOrder' to match the 'Table' interface
        setTables(curr => curr.map(t => t.id === newRec.id ? { id: newRec.id, status: newRec.status, currentOrder: newRec.current_order } : t));
        
        if (isAdmin && newRec.status === 'occupied' && newRec.current_order) {
          if (newRec.current_order.id !== lastNotifiedOrderId.current) {
            lastNotifiedOrderId.current = newRec.current_order.id;
            if (audioEnabled && notificationSound.current) notificationSound.current.play().catch(() => {});
            setActiveAlert({ id: newRec.id, type: newRec.id >= 900 ? 'Pedido Externo' : 'Mesa', msg: 'Novo Pedido!', timestamp: Date.now() });
            setTimeout(() => setActiveAlert(null), 8000);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_config' }, (payload) => {
        const newCfg = payload.new as any;
        if (newCfg) {
          setStoreConfig({
            tablesEnabled: newCfg.tables_enabled,
            deliveryEnabled: newCfg.delivery_enabled,
            counterEnabled: newCfg.counter_enabled,
            statusPanelEnabled: newCfg.status_panel_enabled
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, audioEnabled, fetchData]);

  const activeStatusOrders = useMemo(() => {
    if (!storeConfig.statusPanelEnabled) return [];
    return tables.filter(t => t.status === 'occupied' && t.currentOrder && t.currentOrder.status !== 'delivered' && (t.id <= 12 || t.id >= 950))
      .map(t => t.currentOrder!).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tables, storeConfig.statusPanelEnabled]);

  const handleUpdateStoreConfig = async (newCfg: StoreConfig) => {
    setStoreConfig(newCfg);
    const { error } = await supabase.from('store_config').upsert({
      id: 1,
      tables_enabled: newCfg.tablesEnabled,
      delivery_enabled: newCfg.deliveryEnabled,
      counter_enabled: newCfg.counterEnabled,
      status_panel_enabled: newCfg.statusPanelEnabled
    });

    if (error) {
      console.error("Erro ao atualizar store_config:", error);
      alert("Erro ao salvar configurações no banco de dados.");
      fetchData(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative" onClick={handleUnlockAudio}>
      <HeaderComp />
      {!isLoggedIn && <button onClick={() => setShowLogin(true)} className="absolute top-4 right-4 z-50 text-[10px] font-black text-white/40 bg-gray-800/20 px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-sm border border-white/10">Admin</button>}

      {isAdmin && isLoggedIn && activeAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-6 animate-in slide-in-from-top duration-700">
          <div className="bg-gray-800 border-orange-500 text-white p-5 rounded-[2.5rem] shadow-2xl border-4 flex items-center gap-5">
            <div className="bg-orange-500 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black shrink-0 shadow-lg">🔔</div>
            <div className="flex-1 font-black">
              <h4 className="text-[10px] uppercase text-orange-500 tracking-widest">{activeAlert.msg}</h4>
              <p className="text-lg italic uppercase tracking-tighter leading-none">{activeAlert.type} #{activeAlert.id}</p>
            </div>
            <button onClick={() => setActiveAlert(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><CloseIcon size={18}/></button>
          </div>
        </div>
      )}

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 flex-1 pb-40">
        {isAdmin && isLoggedIn ? (
          <AdminPanel 
            tables={tables} menuItems={menuItems} categories={categories} audioEnabled={audioEnabled} onToggleAudio={() => setAudioEnabled(!audioEnabled)} onTestSound={() => notificationSound.current?.play()}
            onUpdateTable={async (id, status, ord) => { 
              if (status === 'free') await supabase.from('tables').delete().eq('id', id);
              else await supabase.from('tables').upsert({ id, status, current_order: ord || null });
            }}
            onAddToOrder={async (tableId, product) => {
              const table = tables.find(t => t.id === tableId);
              const items = table?.currentOrder ? [...table.currentOrder.items] : [];
              const ex = items.findIndex(i => i.id === product.id);
              if (ex >= 0) items[ex].quantity += 1; else items.push({ ...product, quantity: 1 });
              const total = items.reduce((a, b) => a + (b.price * b.quantity), 0);
              const order = { id: table?.currentOrder?.id || Math.random().toString(36).substr(2, 6).toUpperCase(), customerName: `Mesa ${tableId}`, items, total, finalTotal: total, paymentMethod: 'Pendente', timestamp: new Date().toISOString(), tableId, status: 'preparing' as const, orderType: 'table' as const };
              await supabase.from('tables').upsert({ id: tableId, status: 'occupied', current_order: order });
            }}
            onRefreshData={() => fetchData()} onLogout={async () => { await supabase.auth.signOut(); setIsLoggedIn(false); }}
            onSaveProduct={async (p) => { await supabase.from('products').upsert({ id: p.id || 'p_'+Date.now(), name: p.name, price: p.price, category: p.category, image: p.image, is_available: p.isAvailable }); }}
            onDeleteProduct={async (id) => { await supabase.from('products').delete().eq('id', id); }} dbStatus={dbStatus === 'loading' ? 'loading' : 'ok'}
            storeConfig={storeConfig} onUpdateStoreConfig={handleUpdateStoreConfig}
          />
        ) : (
          <>
            {isStoreClosed ? (
              <div className="flex flex-col items-center justify-center pt-24 pb-32 text-center animate-in fade-in zoom-in duration-700">
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-orange-500 max-w-md w-full relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-100 rounded-full opacity-50 blur-2xl"></div>
                  <div className="bg-orange-500 text-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl ring-8 ring-orange-100">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-gray-800 mb-2">Loja Fechada</h2>
                  <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest mb-8">No momento não estamos aceitando pedidos</p>
                  
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2">Horário de Funcionamento</p>
                    <p className="text-sm font-black text-gray-800 uppercase italic tracking-tight">{STORE_INFO.hours}</p>
                  </div>
                  
                  <a href={`https://wa.me/${STORE_INFO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-green-500 text-white px-8 py-5 rounded-[2rem] font-black uppercase text-[10px] shadow-lg hover:brightness-110 active:scale-95 transition-all">
                    <span>Falar no WhatsApp</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                </div>
              </div>
            ) : (
              <>
                {storeConfig.statusPanelEnabled && activeStatusOrders.length > 0 && (
                  <div className="bg-gray-800 text-white p-6 rounded-[2.5rem] mb-10 shadow-2xl border-4 border-orange-500 overflow-hidden relative">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500">Acompanhe seu Pedido</h3>
                       <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span><span className="text-[8px] uppercase font-black opacity-50">Ao Vivo</span></div>
                    </div>
                    <div className="flex overflow-x-auto gap-4 no-scrollbar pb-2">
                      {activeStatusOrders.map(order => (
                        <div key={order.id} className={`shrink-0 w-44 p-4 rounded-2xl border-2 ${order.status === 'ready' ? 'bg-green-600 border-white animate-pulse' : 'bg-gray-900 border-gray-700'}`}>
                           <div className="flex justify-between items-start mb-1">
                              <span className="text-[8px] font-black uppercase opacity-60">#{order.id}</span>
                              <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10`}>{order.status}</span>
                           </div>
                           <p className="font-black text-xs uppercase truncate">{order.customerName}</p>
                           <p className="text-[7px] font-bold uppercase opacity-40 mt-1">{order.tableId >= 950 ? 'Retirada' : `Mesa ${order.tableId}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex overflow-x-auto gap-2.5 pb-8 no-scrollbar pt-4">
                  {['Todos', ...categories.map(c => c.name)].map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`whitespace-nowrap px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-100'}`}>{cat}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {menuItems.filter(i => selectedCategory === 'Todos' || i.category === selectedCategory).map(item => <MenuItem key={item.id} product={item} activeCoupons={activeCoupons} onAdd={(p) => setCartItems(prev => { const ex = prev.find(i => i.id === p.id); if (ex) return prev.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i); return [...prev, { ...p, quantity: 1 }]; })} />)}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="bg-white p-10 rounded-[3.5rem] w-full max-w-sm text-center animate-in zoom-in shadow-2xl">
            <h2 className="text-2xl font-black mb-8 italic uppercase tracking-tighter text-orange-600">Painel Administrativo</h2>
            <form onSubmit={async (e) => {
              e.preventDefault(); setIsLoadingLogin(true);
              const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
              if (!error && data.session) { setIsLoggedIn(true); setIsAdmin(true); setShowLogin(false); fetchData(); }
              else alert('Erro ao entrar.');
              setIsLoadingLogin(false);
            }} className="space-y-4">
              <input type="email" placeholder="E-MAIL" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-orange-500 transition-all" required />
              <input type="password" placeholder="SENHA" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase outline-none focus:border-orange-500 transition-all" required />
              <button type="submit" disabled={isLoadingLogin} className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl uppercase text-[10px] shadow-lg">Entrar</button>
              <button type="button" onClick={() => setShowLogin(false)} className="text-[10px] font-black text-gray-400 uppercase mt-2">Voltar</button>
            </form>
          </div>
        </div>
      )}

      {!isAdmin && !isStoreClosed && cartItems.length > 0 && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-40">
          <button onClick={() => setIsCartOpen(true)} className="w-full max-w-md bg-gray-800 text-white rounded-[2.5rem] p-5 flex items-center justify-between shadow-2xl ring-4 ring-orange-500/30 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
              <div className="bg-orange-500 text-white w-9 h-9 flex items-center justify-center rounded-2xl text-xs font-black">{cartItems.reduce((a,b)=>a+b.quantity,0)}</div>
              <span className="font-black text-xs uppercase tracking-widest">Minha Sacola</span>
            </div>
            <span className="font-black text-orange-500 text-xl italic">R$ {cartItems.reduce((a,b)=>a+(b.price*b.quantity),0).toFixed(2).replace('.', ',')}</span>
          </button>
        </div>
      )}
      {!isAdmin && <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} items={cartItems} onUpdateQuantity={(id, d) => setCartItems(p => p.map(i => i.id === id ? {...i, quantity: Math.max(1, i.quantity + d)} : i))} onRemove={id => setCartItems(p => p.filter(i => i.id !== id))} onAdd={() => {}} onPlaceOrder={async (ord) => {
        let tid = ord.tableId; if (tid < 0) { const range = tid === -900 ? [900, 949] : [950, 999]; const free = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free'); tid = free?.id || range[0]; }
        const { error } = await supabase.from('tables').upsert({ id: tid, status: 'occupied', current_order: { ...ord, tableId: tid } });
        if (!error) { setCartItems([]); return true; } return false;
      }} storeConfig={storeConfig} />}
    </div>
  );
};

export default App;
