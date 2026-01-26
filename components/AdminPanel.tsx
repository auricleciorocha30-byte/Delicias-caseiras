
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, Order, Product, Category, Coupon, LoyaltyConfig, LoyaltyUser, OrderStatus, StoreConfig, CartItem, OrderType } from '../types';
import { CloseIcon, TrashIcon, VolumeIcon, EditIcon, BackupIcon, RestoreIcon } from './Icons';
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
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);

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

  const filteredMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const deliveryOrders = tables.filter(t => t.id >= 900 && t.id <= 949 && t.status === 'occupied');
  const takeawayOrders = tables.filter(t => t.id >= 950 && t.id <= 999 && t.status === 'occupied');
  
  const selectedOrder = tables.find(t => t.id === selectedOrderId);

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header Admin */}
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
              {tab === 'delivery' ? 'Pedidos' : tab === 'menu' ? 'Cardápio' : tab === 'marketing' ? 'Mkt' : 'Ajustes'}
            </button>
          ))}
        </nav>

        <div className="flex gap-4">
          <button onClick={onLogout} className="bg-red-600 text-white font-black text-[10px] uppercase px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all">Sair</button>
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'delivery' && (
          <div className="space-y-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border">
               <div>
                  <h3 className="text-xl font-black uppercase italic text-[#1A1A1A]">Pedidos Ativos</h3>
                  {deliveryOrders.some(o => o.currentOrder?.status === 'pending') && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
                      <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Existem pedidos pendentes!</span>
                    </div>
                  )}
               </div>
               <button onClick={() => setIsManualOrderModalOpen(true)} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Novo Pedido</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Entregas */}
              <div className="space-y-6">
                <h4 className="font-black uppercase italic tracking-tighter text-[#FF7F11] ml-2">🚚 Entregas ({deliveryOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {deliveryOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center shadow-md transition-all ${t.currentOrder?.status === 'pending' ? 'border-orange-500 ring-4 ring-orange-100' : 'border-[#FF7F11]'}`}>
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

              {/* Retiradas */}
              <div className="space-y-6">
                <h4 className="font-black uppercase italic tracking-tighter text-[#6C7A1D] ml-2">🏪 Retiradas ({takeawayOrders.length})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {takeawayOrders.map(t => (
                    <button key={t.id} onClick={() => setSelectedOrderId(t.id)} className={`bg-white p-6 rounded-[2.5rem] border-4 text-left flex justify-between items-center shadow-md transition-all ${t.currentOrder?.status === 'pending' ? 'border-orange-500 ring-4 ring-orange-100' : 'border-[#6C7A1D]'}`}>
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

        {activeTab === 'menu' && (
          <div className="space-y-10">
            <div className="bg-white p-10 rounded-[4rem] shadow-xl border-t-8 border-[#1A1A1A]">
              <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <h3 className="text-2xl font-black italic uppercase">Gestão de Marmitas</h3>
                <div className="flex gap-4">
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="BUSCAR..." className="bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" />
                  <button onClick={() => { setEditingProduct({ name: '', price: 0, category: categories[0]?.name || '', isAvailable: true, description: '' }); setIsProductModalOpen(true); }} className="bg-[#1A1A1A] text-[#FF7F11] px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nova Marmita</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className={`bg-gray-50 p-5 rounded-[3rem] border-2 transition-all relative group shadow-sm ${!item.isAvailable ? 'opacity-40 border-red-200' : 'border-transparent hover:border-[#FF7F11]'}`}>
                    <img src={item.image} className="w-full aspect-square object-cover rounded-[2rem] mb-4" />
                    <h4 className="font-black text-[11px] uppercase truncate">{item.name}</h4>
                    <p className="text-[#FF7F11] font-black italic text-[14px] mb-4">R$ {item.price.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-blue-500 hover:bg-blue-50 transition-colors"><EditIcon size={18}/></button>
                      <button onClick={() => { 
                        const nextAvailable = !item.isAvailable;
                        onSaveProduct({ ...item, isAvailable: nextAvailable });
                      }} className={`flex-1 p-3 rounded-xl shadow-sm transition-colors ${item.isAvailable ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {item.isAvailable ? 'Ativo' : 'Off'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PRODUTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl">
             <button onClick={() => setIsProductModalOpen(false)} className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full"><CloseIcon size={20}/></button>
             <h3 className="text-2xl font-black italic mb-10 uppercase text-center">Configurar Marmita</h3>
             <form onSubmit={(e) => { e.preventDefault(); onSaveProduct(editingProduct); setIsProductModalOpen(false); }} className="space-y-5">
                <input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="NOME" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none focus:border-[#FF7F11]" required />
                <textarea value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="DESCRIÇÃO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11] h-24 resize-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} placeholder="PREÇO" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none focus:border-[#FF7F11]" required />
                  <select value={editingProduct?.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black uppercase outline-none">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <input value={editingProduct?.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="URL DA IMAGEM" className="w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-[11px] font-black outline-none" />
                <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl">
                   <input type="checkbox" checked={editingProduct?.isAvailable} onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})} className="w-6 h-6 rounded-lg accent-[#FF7F11]" />
                   <label className="text-[10px] font-black uppercase">Disponível no Site</label>
                </div>
                <button type="submit" className="w-full bg-[#1A1A1A] text-[#FF7F11] py-6 rounded-3xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all">Salvar Alterações</button>
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
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[#1A1A1A]">Pedido de {selectedOrder.currentOrder?.customerName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                      ID: #{selectedOrder.currentOrder?.id} • {selectedOrder.id >= 950 ? 'Retirada na Loja' : 'Entrega Domicílio'}
                    </p>
                 </div>
                 <button onClick={() => setSelectedOrderId(null)} className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><CloseIcon size={24}/></button>
              </div>

              <div className="flex-1 space-y-8">
                 <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-4 ml-2">Atualizar Status</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {(['pending', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map(s => (
                          <button key={s} onClick={() => onUpdateTable(selectedOrder.id, 'occupied', { ...selectedOrder.currentOrder!, status: s })} className={`py-4 rounded-2xl text-[9px] font-black uppercase border-4 transition-all ${selectedOrder.currentOrder?.status === s ? 'bg-[#FF7F11] text-white border-[#1A1A1A] shadow-lg' : 'bg-white text-gray-400 border-transparent hover:border-gray-200'}`}>
                             {STATUS_CFG[s].label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Marmitas Solicitadas</h4>
                    {selectedOrder.currentOrder?.items.map((item, idx) => (
                       <div key={idx} className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-gray-100">
                          <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
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
                      <p className="text-[9px] font-black uppercase text-[#FF7F11] mb-2 tracking-widest">Endereço para Entrega</p>
                      <p className="text-sm font-bold uppercase leading-relaxed">{selectedOrder.currentOrder.address}</p>
                   </div>
                 )}
              </div>

              <div className="pt-10 mt-10 border-t flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Final do Pedido</p>
                    <p className="text-4xl font-black italic text-[#1A1A1A]">R$ {selectedOrder.currentOrder?.finalTotal.toFixed(2)}</p>
                 </div>
                 <button onClick={() => { if(confirm('Concluir e arquivar pedido?')) { onUpdateTable(selectedOrder.id, 'free'); setSelectedOrderId(null); } }} className="bg-[#6C7A1D] text-white px-10 py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Concluir Pedido ✅</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
