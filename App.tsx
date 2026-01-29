
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import HeaderComp from './components/Header';
import MenuItem from './components/MenuItem';
import Cart from './components/Cart';
import AdminPanel from './components/AdminPanel';
import { INITIAL_TABLES, STORE_INFO } from './constants';
import { Product, CartItem, Table, Order, Category, Coupon, StoreConfig } from './types';
import { supabase } from './lib/supabase';

const Footer: React.FC = () => (
  <footer className="w-full py-16 px-6 bg-brand-cream border-t border-brand-orange/10 flex flex-col items-center text-center mt-12">
    <div className="bg-brand-orange w-20 h-1.5 rounded-full mb-10"></div>
    <div className="mb-8">
      <h4 className="text-3xl font-black italic uppercase tracking-tighter text-brand-dark leading-none">Ju Marmitas Caseiras</h4>
      <p className="text-[9px] font-black uppercase text-brand-green tracking-[0.3em] mt-2">{STORE_INFO.slogan}</p>
    </div>
    <div className="flex flex-col items-center gap-4 mb-10">
      <div className="flex items-center gap-3 text-brand-orange bg-white px-6 py-3 rounded-2xl border border-brand-orange/10 shadow-sm">
        <span className="text-sm font-black tracking-tight leading-none">{STORE_INFO.whatsapp}</span>
      </div>
    </div>
    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">© {new Date().getFullYear()} • Saúde e Bem-estar.</p>
  </footer>
);

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(true);
  const [isCustomerView, setIsCustomerView] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<Coupon[]>([]);
  const [dbStatus, setDbStatus] = useState<'loading' | 'ok'>('loading');
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    tablesEnabled: false, deliveryEnabled: true, counterEnabled: true, statusPanelEnabled: false
  });

  const playDing = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playTone = (freq: number, start: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const { gainNode } = { gainNode: ctx.createGain() }; // Fixed typo in local variable declaration if needed, but the logic remains
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(ctx.currentTime + start);
        oscillator.stop(ctx.currentTime + start + duration);
      };
      playTone(523.25, 0, 0.5); // C5
      playTone(659.25, 0.15, 0.5); // E5
      playTone(783.99, 0.3, 0.6); // G5
    } catch (e) {
      console.warn("Audio blocked by browser policy");
    }
  }, []);

  const fetchData = useCallback(async () => {
    setDbStatus('loading');
    const [catRes, coupRes, prodRes, tableRes, configRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('coupons').select('*').eq('is_active', true),
      supabase.from('products').select('*').order('name'),
      supabase.from('tables').select('*').order('id'),
      supabase.from('store_config').select('*').maybeSingle()
    ]);

    if (configRes.data) {
      setStoreConfig({
        tablesEnabled: false,
        deliveryEnabled: configRes.data.delivery_enabled,
        counterEnabled: configRes.data.counter_enabled,
        // Correcting status_panel_enabled to statusPanelEnabled
        statusPanelEnabled: configRes.data.status_panel_enabled
      });
    }

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
        if (idx >= 0) merged[idx] = { id: dbT.id, status: dbT.status, current_order: dbT.current_order };
      });
      setTables(merged);
    }
    setDbStatus('ok');
  }, []);

  // Monitoramento Realtime para novos pedidos
  useEffect(() => {
    if (!isLoggedIn) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', table: 'tables', schema: 'public' }, (payload) => {
        const newData = payload.new as any;
        const oldData = payload.old as any;

        // Se uma mesa mudou de livre para ocupada, é um novo pedido
        if (newData.status === 'occupied' && (!oldData || oldData.status === 'free')) {
          playDing();
          setShowNewOrderAlert(true);
        }
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, playDing, fetchData]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setIsLoadingLogin(false);
      if (session) fetchData();
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) fetchData();
    });
    return () => subscription.unsubscribe();
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'menu') setIsCustomerView(true);
  }, []);

  const handleUpdateStoreConfig = async (newCfg: StoreConfig) => {
    setStoreConfig(newCfg);
    await supabase.from('store_config').upsert({
      id: 1,
      tables_enabled: false,
      delivery_enabled: newCfg.deliveryEnabled,
      counter_enabled: newCfg.counterEnabled,
      status_panel_enabled: newCfg.statusPanelEnabled
    });
  };

  if (isCustomerView) {
    const isStoreClosed = !storeConfig.deliveryEnabled && !storeConfig.counterEnabled;
    return (
      <div className="min-h-screen bg-brand-cream flex flex-col font-sans">
        <HeaderComp />
        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-20 flex-1 -mt-10 pb-40">
          {isStoreClosed ? (
            <div className="flex flex-col items-center justify-center pt-24 pb-32 text-center">
               <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-brand-orange max-w-md w-full">
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter text-brand-dark mb-2 leading-none">Loja Fechada</h2>
                  <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest mb-8">Nossas marmitas estão descansando!</p>
                  <a href={`https://wa.me/${STORE_INFO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-brand-green text-white px-10 py-5 rounded-[2.5rem] font-black uppercase text-[10px] shadow-lg">
                    <span>Chame no WhatsApp</span>
                  </a>
               </div>
            </div>
          ) : (
            <>
              <div className="flex overflow-x-auto gap-3 pb-10 no-scrollbar pt-2">
                {['Todos', ...categories.map(c => c.name)].map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`whitespace-nowrap px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-md ${selectedCategory === cat ? 'bg-brand-orange text-white' : 'bg-white text-gray-500'}`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
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
            <button onClick={() => setIsCartOpen(true)} className="w-full max-w-lg bg-brand-dark text-white rounded-[3rem] p-6 flex items-center justify-between shadow-2xl ring-8 ring-brand-orange/20">
              <div className="flex items-center gap-5">
                <div className="bg-brand-orange text-white w-12 h-12 flex items-center justify-center rounded-2xl font-black">{cartItems.reduce((a,b)=>a+b.quantity,0)}</div>
                <span className="font-black text-[12px] uppercase">Minha Sacola</span>
              </div>
              <span className="font-black text-brand-orange text-2xl italic">R$ {cartItems.reduce((a,b)=>a+(b.price*b.quantity),0).toFixed(2).replace('.', ',')}</span>
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
          if (!error) { setCartItems([]); fetchData(); return true; } 
          return false;
        }} storeConfig={storeConfig} />
      </div>
    );
  }

  if (isLoadingLogin) {
    return <div className="min-h-screen bg-brand-cream flex items-center justify-center font-black uppercase text-brand-orange animate-pulse">Carregando...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 md:p-14 rounded-[4rem] w-full max-w-md text-center shadow-2xl border-t-8 border-brand-orange">
          <h2 className="text-3xl font-black mb-2 italic uppercase tracking-tighter text-brand-dark">Ju Admin</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass });
            if (!error && data.session) { setIsLoggedIn(true); fetchData(); }
            else alert('Credenciais incorretas.');
          }} className="space-y-4 mt-8">
            <input type="email" placeholder="E-MAIL" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full bg-gray-50 border-2 rounded-3xl px-8 py-5 text-xs font-black outline-none focus:border-brand-orange text-center" required />
            <input type="password" placeholder="SENHA" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-gray-50 border-2 rounded-3xl px-8 py-5 text-xs font-black outline-none focus:border-brand-orange text-center" required />
            <button type="submit" className="w-full bg-brand-dark text-brand-orange font-black py-6 rounded-3xl uppercase text-[11px] shadow-xl hover:scale-105 transition-all">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream p-6 font-sans">
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
          await supabase.from('products').upsert({ id: p.id || 'p_'+Date.now(), name: p.name, price: p.price, category: p.category, image: p.image, is_available: p.isAvailable, description: p.description }); 
          fetchData();
        }}
        onDeleteProduct={async (id) => { await supabase.from('products').delete().eq('id', id); fetchData(); }}
        dbStatus={dbStatus} storeConfig={storeConfig} onUpdateStoreConfig={handleUpdateStoreConfig}
        showNewOrderAlert={showNewOrderAlert}
        onClearAlert={() => setShowNewOrderAlert(false)}
      />
    </div>
  );
};

export default App;
