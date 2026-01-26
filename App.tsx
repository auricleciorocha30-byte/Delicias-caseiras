
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import HeaderComp from './components/Header';
import MenuItem from './components/MenuItem';
import Cart from './components/Cart';
import AdminPanel from './components/AdminPanel';
import { INITIAL_TABLES, STORE_INFO } from './constants';
import { Product, CartItem, Table, Order, Category, Coupon, StoreConfig } from './types';
import { supabase } from './lib/supabase';

const Footer: React.FC = () => (
  <footer className="w-full py-16 px-6 bg-[#FFF9E5] border-t border-[#FF7F11]/10 flex flex-col items-center text-center mt-12">
    <div className="bg-[#FF7F11] w-20 h-1.5 rounded-full mb-10"></div>
    <div className="mb-8">
      <h4 className="text-3xl font-black italic uppercase tracking-tighter text-[#1A1A1A] leading-none">Ju Marmitas Caseiras</h4>
      <p className="text-[9px] font-black uppercase text-[#6C7A1D] tracking-[0.3em] mt-2">{STORE_INFO.slogan}</p>
    </div>
    <div className="flex flex-col items-center gap-4 mb-10">
      <div className="flex items-center gap-3 text-[#FF7F11] bg-white px-6 py-3 rounded-2xl border border-[#FF7F11]/10 shadow-sm">
        <span className="text-sm font-black tracking-tight leading-none">(85) 99764-4326</span>
      </div>
    </div>
    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">© {new Date().getFullYear()} • Saúde e Bem-estar.</p>
  </footer>
);

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  const [isCustomerView, setIsCustomerView] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([]);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok'>('loading');
  
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    tablesEnabled: false, deliveryEnabled: true, counterEnabled: true, statusPanelEnabled: false
  });

  const playDing = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context blocked.");
    }
  }, []);

  const isStoreClosed = useMemo(() => {
    return !storeConfig.deliveryEnabled && !storeConfig.counterEnabled;
  }, [storeConfig]);

  const fetchData = useCallback(async () => {
    setDbStatus('loading');
    const [catRes, coupRes, prodRes, tableRes, configRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('coupons').select('*').eq('is_active', true),
      supabase.from('products').select('*').order('name'),
      supabase.from('tables').select('*').order('id'),
      supabase.from('store_config').select('*').maybeSingle()
    ]);

    if (configRes.data) setStoreConfig({
      tablesEnabled: false,
      deliveryEnabled: configRes.data.delivery_enabled,
      counterEnabled: configRes.data.counter_enabled,
      statusPanelEnabled: configRes.data.status_panel_enabled
    });

    if (catRes.data) setCategories(catRes.data);
    if (coupRes.data) setActiveCoupons(coupRes.data.map((c: any) => ({ 
      id: c.id, code: c.code, percentage: c.percentage, isActive: c.is_active, 
      scopeType: c.scope_type, scopeValue: c.scope_value 
    })));
    
    if (prodRes.data) setMenuItems(prodRes.data.map((p: any) => ({ 
      id: p.id, name: p.name, description: p.description || '', price: Number(p.price), 
      category: p.category, image: p.image, isAvailable: p.is_available ?? true 
    })));

    if (tableRes.data) {
      const merged = [...INITIAL_TABLES];
      tableRes.data.forEach((dbT: any) => {
        const idx = merged.findIndex(t => t.id === dbT.id);
        if (idx >= 0) merged[idx] = { 
          id: dbT.id, 
          status: dbT.status, 
          currentOrder: dbT.current_order 
        };
      });
      setTables(merged);
    }
    setDbStatus('ok');
  }, []);

  useEffect(() => {
    const tableSub = supabase
      .channel('tables_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
        const newData = payload.new as any;
        const oldData = payload.old as any;
        if (newData.status === 'occupied' && (!oldData || oldData.status === 'free')) {
          if (isLoggedIn) playDing();
        }
        fetchData();
      })
      .subscribe();

    const productSub = supabase
      .channel('products_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tableSub);
      supabase.removeChannel(productSub);
    };
  }, [fetchData, isLoggedIn, playDing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'menu') setIsCustomerView(true);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsLoggedIn(true);
      fetchData();
    });
  }, [fetchData]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingLogin(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass });
    if (!error && data.session) {
      setIsLoggedIn(true);
      fetchData();
    } else {
      alert('Credenciais incorretas.');
    }
    setIsLoadingLogin(false);
  };

  const handleUpdateStoreConfig = async (newCfg: StoreConfig) => {
    const updatedCfg = { ...newCfg, tablesEnabled: false };
    setStoreConfig(updatedCfg);
    await supabase.from('store_config').upsert({
      id: 1,
      tables_enabled: false,
      delivery_enabled: updatedCfg.deliveryEnabled,
      counter_enabled: updatedCfg.counterEnabled,
      status_panel_enabled: updatedCfg.statusPanelEnabled
    });
  };

  if (isCustomerView) {
    return (
      <div className="min-h-screen bg-[#FFF9E5] flex flex-col font-sans">
        <HeaderComp />
        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-20 flex-1 -mt-10 pb-40">
          {isStoreClosed ? (
            <div className="flex flex-col items-center justify-center pt-24 pb-32 text-center animate-in fade-in zoom-in duration-700">
               <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-[#FF7F11] max-w-md w-full relative overflow-hidden">
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#1A1A1A] mb-2 leading-none">Loja Fechada</h2>
                  <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest mb-8">Nossas marmitas estão descansando!</p>
                  <a href={`https://wa.me/${STORE_INFO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-[#6C7A1D] text-white px-10 py-5 rounded-[2.5rem] font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">
                    <span>Chame no WhatsApp</span>
                  </a>
               </div>
            </div>
          ) : (
            <>
              <div className="flex overflow-x-auto gap-3 pb-10 no-scrollbar pt-2">
                {['Todos', ...categories.map(c => c.name)].map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`whitespace-nowrap px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-md ${selectedCategory === cat ? 'bg-[#FF7F11] text-white' : 'bg-white text-gray-500'}`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {/* REMOVIDO FILTRO DE ISAVAILABLE PARA MOSTRAR ESGOTADOS */}
                {menuItems.filter(i => (selectedCategory === 'Todos' || i.category === selectedCategory)).map(item => (
                  <MenuItem key={item.id} product={item} activeCoupons={activeCoupons} onAdd={(p) => setCartItems(prev => { 
                    const ex = prev.find(i => i.id === p.id); 
                    if (ex) return prev.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i); 
                    return [...prev, { ...p, quantity: 1 }]; 
                  })} />
                ))}
              </div>
            </>
          )}
        </main>
        <Footer />
        {!isStoreClosed && cartItems.length > 0 && (
          <div className="fixed bottom-10 left-0 right-0 flex justify-center px-8 z-40">
            <button onClick={() => setIsCartOpen(true)} className="w-full max-w-lg bg-[#1A1A1A] text-white rounded-[3rem] p-6 flex items-center justify-between shadow-2xl ring-8 ring-[#FF7F11]/20 active:scale-95 transition-all">
              <div className="flex items-center gap-5">
                <div className="bg-[#FF7F11] text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black">{cartItems.reduce((a,b)=>a+b.quantity,0)}</div>
                <span className="font-black text-[12px] uppercase">Minha Sacola</span>
              </div>
              <span className="font-black text-[#FF7F11] text-2xl italic">R$ {cartItems.reduce((a,b)=>a+(b.price*b.quantity),0).toFixed(2).replace('.', ',')}</span>
            </button>
          </div>
        )}
        <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} items={cartItems} onUpdateQuantity={(id, d) => setCartItems(p => p.map(i => i.id === id ? {...i, quantity: Math.max(1, i.quantity + d)} : i))} onRemove={id => setCartItems(p => p.filter(i => i.id !== id))} onAdd={() => {}} onPlaceOrder={async (ord) => {
          let tid = ord.tableId; 
          if (tid < 0) { 
            const range = tid === -900 ? [900, 949] : [950, 999]; 
            const free = tables.find(t => t.id >= range[0] && t.id <= range[1] && t.status === 'free'); 
            tid = free?.id || range[0]; 
          }
          const { error } = await supabase.from('tables').upsert({ id: tid, status: 'occupied', current_order: { ...ord, tableId: tid } });
          if (!error) { 
            setCartItems([]); 
            fetchData();
            return true; 
          } 
          return false;
        }} storeConfig={storeConfig} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FFF9E5] flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 md:p-14 rounded-[4rem] w-full max-w-md text-center shadow-2xl border-t-8 border-[#FF7F11]">
          <h2 className="text-3xl font-black mb-2 italic uppercase tracking-tighter">Ju Marmitas</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-10">Admin Access</p>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <input type="email" placeholder="E-MAIL" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-gray-50 border-2 rounded-3xl px-8 py-5 text-xs font-black outline-none focus:border-[#FF7F11] text-center" required />
            <input type="password" placeholder="SENHA" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-gray-50 border-2 rounded-3xl px-8 py-5 text-xs font-black outline-none focus:border-[#FF7F11] text-center" required />
            <button type="submit" disabled={isLoadingLogin} className="w-full bg-[#1A1A1A] text-[#FF7F11] font-black py-6 rounded-3xl uppercase text-[11px] shadow-xl hover:scale-105 transition-all">
              {isLoadingLogin ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9E5] p-6 font-sans">
      <AdminPanel 
        tables={tables} menuItems={menuItems} categories={categories} audioEnabled={true} onToggleAudio={() => {}} onTestSound={playDing}
        onUpdateTable={async (id, status, ord) => { 
          await supabase.from('tables').upsert({ id, status, current_order: ord || null });
          fetchData();
        }}
        onAddToOrder={() => {}}
        onRefreshData={() => fetchData()} 
        onLogout={async () => { await supabase.auth.signOut(); setIsLoggedIn(false); }}
        onSaveProduct={async (p) => { 
          await supabase.from('products').upsert({ 
            id: p.id || 'p_'+Date.now(), 
            name: p.name, 
            price: p.price, 
            category: p.category, 
            image: p.image, 
            is_available: p.isAvailable, 
            description: p.description 
          }); 
          fetchData();
        }}
        onDeleteProduct={async (id) => { 
          await supabase.from('products').delete().eq('id', id); 
          fetchData();
        }}
        dbStatus={dbStatus} storeConfig={storeConfig} onUpdateStoreConfig={handleUpdateStoreConfig}
      />
    </div>
  );
};

export default App;
