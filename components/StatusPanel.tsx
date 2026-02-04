
import React from 'react';
import { Table, OrderStatus } from '../types';
import { CloseIcon } from './Icons';

interface StatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Table[];
}

const STATUS_MAP: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Recebido', color: 'bg-orange-100 text-orange-600 border-orange-200', icon: '⏳' },
  preparing: { label: 'Preparando', color: 'bg-blue-100 text-blue-600 border-blue-200', icon: '👨‍🍳' },
  ready: { label: 'Pronto para Retirada', color: 'bg-green-100 text-green-600 border-green-500 animate-bounce', icon: '✅' },
  delivered: { label: 'Entregue', color: 'bg-gray-100 text-gray-400 border-gray-200', icon: '🏁' }
};

const StatusPanel: React.FC<StatusPanelProps> = ({ isOpen, onClose, orders }) => {
  if (!isOpen) return null;

  // Filtramos apenas pedidos ativos (não entregues há muito tempo ou ocupados)
  const activeOrders = orders.filter(t => 
    t.status === 'occupied' && 
    t.currentOrder && 
    t.currentOrder.status !== 'delivered'
  );

  return (
    <div className="fixed inset-0 z-[100] bg-brand-dark/95 backdrop-blur-md flex flex-col p-6 md:p-12 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl md:text-5xl font-black italic text-brand-orange uppercase tracking-tighter leading-none">Acompanhe seu Pedido</h2>
          <p className="text-[10px] md:text-[12px] text-white font-black uppercase tracking-[0.3em] mt-2 opacity-60">Status em tempo real das nossas marmitas</p>
        </div>
        <button onClick={onClose} className="bg-white/10 text-white p-4 rounded-full hover:bg-white/20 transition-all active:scale-90">
          <CloseIcon size={32} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeOrders.map(t => {
              const order = t.currentOrder!;
              const cfg = STATUS_MAP[order.status];
              return (
                <div key={t.id} className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-b-8 border-brand-orange relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter truncate max-w-[200px]">{order.customerName}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Pedido #{order.id}</p>
                    </div>
                    <span className="text-3xl">{cfg.icon}</span>
                  </div>

                  <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest ${cfg.color}`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                    {cfg.label}
                  </div>

                  <div className="mt-8 pt-6 border-t border-dashed flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-300 uppercase">Local: {t.id >= 950 ? 'Retirada' : t.id >= 900 ? 'Delivery' : `Mesa ${t.id}`}</span>
                    <span className="text-[10px] font-bold text-gray-400">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="bg-white/5 p-12 rounded-full mb-8">
              <span className="text-7xl">🍲</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Nenhuma marmita no fogo agora</h3>
            <p className="text-white/40 font-black text-[10px] uppercase tracking-widest mt-4">Faça seu pedido e ele aparecerá aqui!</p>
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <p className="text-brand-orange font-black text-[10px] uppercase tracking-[0.5em] animate-pulse">Atualizado automaticamente</p>
      </div>
    </div>
  );
};

export default StatusPanel;
