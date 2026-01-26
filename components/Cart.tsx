
import React, { useState, useMemo, useEffect } from 'react';
import { CartItem, Product, Order, OrderType, Coupon, LoyaltyConfig, StoreConfig } from '../types';
import { CloseIcon, TrashIcon } from './Icons';
import { supabase } from '../lib/supabase';
import { STORE_INFO } from '../constants';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onAdd: (product: Product) => void;
  onPlaceOrder: (order: Order) => Promise<boolean>;
  storeConfig: StoreConfig;
}

const Cart: React.FC<CartProps> = ({ isOpen, onClose, items, onUpdateQuantity, onRemove, onAdd, onPlaceOrder, storeConfig }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Coupon[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Pix' | 'Cartão'>('Pix');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (storeConfig.deliveryEnabled) setOrderType('delivery');
    else if (storeConfig.counterEnabled) setOrderType('takeaway');
  }, [storeConfig]);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setIsSuccess(false), 500);
    }
  }, [isOpen]);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items]);
  
  const discount = useMemo(() => {
    if (appliedCoupons.length === 0) return 0;
    
    return items.reduce((totalDiscount, item) => {
      const validCoupons = appliedCoupons.filter(c => {
        if (!c.isActive) return false;
        if (c.scopeType === 'all') return true;
        const scopeValues = (c.scopeValue || '').split(',');
        if (c.scopeType === 'category') return scopeValues.includes(item.category);
        if (c.scopeType === 'product') return scopeValues.includes(item.id);
        return false;
      });

      if (validCoupons.length === 0) return totalDiscount;
      const bestCoupon = validCoupons.reduce((prev, curr) => (curr.percentage > prev.percentage) ? curr : prev);
      return totalDiscount + (item.price * item.quantity * bestCoupon.percentage / 100);
    }, 0);
  }, [appliedCoupons, items]);

  const finalTotal = subtotal - discount;

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).eq('is_active', true).maybeSingle();
      if (error) throw error;
      if (data) setAppliedCoupons([{ id: data.id, code: data.code, percentage: data.percentage, isActive: data.is_active, scopeType: data.scope_type, scopeValue: data.scope_value || '' }]);
      else alert('Cupom inválido.');
    } catch (err) { alert('Erro ao validar.'); }
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (!customerName.trim()) return alert('Informe seu nome.');
    if (orderType === 'delivery' && !address.trim()) return alert('Endereço obrigatório.');

    setIsProcessing(true);
    let targetTableId = orderType === 'delivery' ? -900 : -950;
    
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      customerName, customerPhone: customerPhone.trim() || undefined,
      items: [...items], total: subtotal, discount, finalTotal, paymentMethod,
      timestamp: new Date().toISOString(), tableId: targetTableId,
      orderType: orderType === 'takeaway' ? 'counter' : orderType,
      address: orderType === 'delivery' ? address : undefined, status: 'pending'
    };

    try {
      const success = await onPlaceOrder(newOrder);
      if (success) {
        setIsSuccess(true);
        setAppliedCoupons([]);
        setCouponCode('');
      }
    } catch (err) { alert('Erro ao processar.'); } finally { setIsProcessing(false); }
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[50] transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}/>
      <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-white z-[60] shadow-2xl transition-transform duration-700 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {isSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center font-black animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-[#FF8000]/10 text-[#FF8000] rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-4xl mb-6 italic uppercase tracking-tighter text-[#FF8000] leading-none">Tudo Pronto!</h2>
            <p className="text-[#666666] uppercase text-[10px] tracking-[0.2em] leading-relaxed">Já estamos preparando sua marmita.</p>
            <button onClick={onClose} className="w-full bg-gray-900 text-[#FF8000] py-7 rounded-[2.5rem] uppercase mt-16 text-[12px] font-black tracking-[0.2em] shadow-2xl">Voltar</button>
          </div>
        ) : (
          <>
            <div className="p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10 font-black italic">
              <h2 className="text-3xl uppercase tracking-tighter leading-none">Minha Sacola</h2>
              <button onClick={onClose} className="p-4 hover:bg-gray-100 rounded-full transition-all active:scale-90"><CloseIcon size={28} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar pb-40">
              {items.length > 0 ? (
                <>
                  <div className="bg-gray-50 p-8 rounded-[3rem] border border-gray-100 space-y-8 font-black uppercase shadow-inner">
                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Como te chamamos?</p>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="NOME" className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none focus:border-[#FF8000]"/>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="WHATSAPP" className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none focus:border-[#FF8000]"/>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Tipo de Pedido</p>
                      <div className="grid grid-cols-2 gap-2">
                        {storeConfig.counterEnabled && (
                          <button onClick={() => setOrderType('takeaway')} className={`py-4 rounded-2xl text-[9px] border-2 transition-all ${orderType === 'takeaway' ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>Balcão</button>
                        )}
                        {storeConfig.deliveryEnabled && (
                          <button onClick={() => setOrderType('delivery')} className={`py-4 rounded-2xl text-[9px] border-2 transition-all ${orderType === 'delivery' ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>Entrega</button>
                        )}
                      </div>
                    </div>

                    {orderType === 'delivery' && (
                      <div className="space-y-3">
                        <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Endereço</p>
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="RUA, NÚMERO..." className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none h-28 resize-none focus:border-[#FF8000] transition-all"/>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Pagamento</p>
                      <div className="grid grid-cols-3 gap-2">{(['Pix', 'Dinheiro', 'Cartão'] as const).map(method => (
                        <button key={method} onClick={() => setPaymentMethod(method)} className={`py-4 rounded-2xl text-[10px] border-2 transition-all ${paymentMethod === method ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>{method}</button>
                      ))}</div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="CUPOM?" className="flex-1 bg-white border-2 rounded-2xl px-6 py-5 text-[11px] outline-none uppercase tracking-widest"/>
                      <button onClick={handleValidateCoupon} className="bg-gray-900 text-[#FF8000] px-8 py-5 rounded-2xl text-[11px] shadow-xl">OK</button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {items.map(item => (
                      <div key={item.id} className="flex gap-5 bg-white p-5 rounded-[2.5rem] border items-center relative shadow-sm">
                        <button onClick={() => onRemove(item.id)} className="absolute top-5 right-5 text-red-300 p-2 rounded-xl transition-all z-10"><TrashIcon size={18} /></button>
                        <img src={item.image} className="w-20 h-20 rounded-3xl object-cover" />
                        <div className="flex-1 font-black">
                          <h4 className="text-[13px] uppercase truncate mb-1">{item.name}</h4>
                          <p className="text-[#FF8000] text-[15px] italic">R$ {item.price.toFixed(2)}</p>
                          <div className="mt-4 flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl w-fit">
                            <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">-</button>
                            <span className="text-[13px] w-6 text-center">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center">+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-40 opacity-20 grayscale">
                  <p className="font-black uppercase text-[12px] tracking-[0.3em] text-center">Sacola vazia</p>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-10 border-t-8 border-gray-50 bg-white sticky bottom-0 rounded-t-[4rem] z-20 font-black italic shadow-2xl">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <span className="text-[10px] text-[#666666] not-italic uppercase tracking-[0.25em]">Total</span>
                    <span className="text-5xl block tracking-tighter">R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                <button 
                  onClick={handleCheckout} 
                  disabled={isProcessing} 
                  className="w-full bg-gray-900 text-[#FF8000] py-7 rounded-[2.5rem] uppercase text-[13px] font-black tracking-[0.25em] shadow-2xl"
                >
                  {isProcessing ? 'Enviando...' : 'Finalizar Pedido'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Cart;
