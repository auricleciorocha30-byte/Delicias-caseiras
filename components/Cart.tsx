
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
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('table');
  const [address, setAddress] = useState('');
  const [observation, setObservation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Pix' | 'Cartão'>('Pix');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (storeConfig.tablesEnabled) setOrderType('table');
    else if (storeConfig.deliveryEnabled) setOrderType('delivery');
    else if (storeConfig.counterEnabled) setOrderType('takeaway');
  }, [storeConfig]);

  useEffect(() => {
    if (isOpen) {
      supabase.from('loyalty_config').select('*').maybeSingle().then(({ data }) => { 
        if (data) setLoyaltyConfig({
          isActive: data.is_active,
          spendingGoal: data.spending_goal,
          scopeType: data.scope_type,
          scopeValue: data.scope_value || ''
        }); 
      });
    } else {
      if (!isOpen) setTimeout(() => setIsSuccess(false), 500);
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
      else alert('Cupom inválido ou expirado.');
    } catch (err) { alert('Erro ao validar cupom.'); }
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (!customerName.trim()) return alert('Por favor, informe seu nome.');
    if (orderType === 'table' && !tableNumber) return alert('Mesa obrigatória.');
    if (orderType === 'delivery' && !address.trim()) return alert('Endereço obrigatório.');

    setIsProcessing(true);
    let targetTableId = orderType === 'table' ? (parseInt(tableNumber) || 0) : orderType === 'delivery' ? -900 : -950;
    
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      customerName, customerPhone: customerPhone.trim() || undefined,
      items: [...items], total: subtotal, discount, finalTotal, paymentMethod,
      timestamp: new Date().toISOString(), tableId: targetTableId,
      orderType: orderType === 'takeaway' ? 'counter' : orderType,
      address: orderType === 'delivery' ? address : undefined, status: 'pending', 
      couponCode: appliedCoupons.length > 0 ? appliedCoupons[0].code : undefined,
      observation: observation.trim() || undefined
    };

    try {
      const success = await onPlaceOrder(newOrder);
      if (success) {
        setIsSuccess(true);
        setAppliedCoupons([]);
        setCouponCode('');
        setObservation('');
      }
    } catch (err) { alert('Erro ao processar checkout.'); } finally { setIsProcessing(false); }
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[50] transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}/>
      <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-white z-[60] shadow-2xl transition-transform duration-700 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {isSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center font-black animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-[#FF8000]/10 text-[#FF8000] rounded-full flex items-center justify-center mx-auto mb-10 animate-bounce shadow-2xl border-4 border-[#FF8000]/20">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-4xl mb-6 italic uppercase tracking-tighter text-[#FF8000] leading-none">Delícia à Caminho!</h2>
            <p className="text-[#666666] uppercase text-[10px] tracking-[0.2em] leading-relaxed max-w-[240px]">Seu pedido foi recebido com um sorriso. Já estamos preparando!</p>
            <button onClick={() => { onClose(); }} className="w-full bg-gray-900 text-[#FF8000] py-7 rounded-[2.5rem] uppercase mt-16 text-[12px] font-black tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Explorar Mais</button>
          </div>
        ) : (
          <>
            <div className="p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10 font-black italic">
              <div><h2 className="text-3xl uppercase tracking-tighter leading-none">Minha Sacola</h2><span className="text-[10px] text-[#666666] not-italic uppercase tracking-[0.25em]">{items.length} Itens Selecionados</span></div>
              <button onClick={onClose} className="p-4 hover:bg-gray-100 rounded-full transition-all active:scale-90"><CloseIcon size={28} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 no-scrollbar pb-40">
              {items.length > 0 ? (
                <>
                  <div className="bg-gray-50 p-8 rounded-[3rem] border border-gray-100 space-y-8 font-black uppercase shadow-inner">
                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Sua Identificação</p>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="COMO TE CHAMAMOS?" className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none shadow-sm focus:border-[#FF8000] transition-all"/>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="WHATSAPP" className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none shadow-sm focus:border-[#FF8000] transition-all"/>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Onde Estás?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {storeConfig.tablesEnabled && (
                          <button onClick={() => setOrderType('table')} className={`py-4 rounded-2xl text-[9px] border-2 transition-all ${orderType === 'table' ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>Mesa</button>
                        )}
                        {storeConfig.counterEnabled && (
                          <button onClick={() => setOrderType('takeaway')} className={`py-4 rounded-2xl text-[9px] border-2 transition-all ${orderType === 'takeaway' ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>Balcão</button>
                        )}
                        {storeConfig.deliveryEnabled && (
                          <button onClick={() => setOrderType('delivery')} className={`py-4 rounded-2xl text-[9px] border-2 transition-all ${orderType === 'delivery' ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>Entrega</button>
                        )}
                      </div>
                    </div>

                    {orderType === 'table' && (
                      <div className="space-y-3">
                        <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Número da Mesa</p>
                        <div className="grid grid-cols-4 gap-2">{Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <button key={num} onClick={() => setTableNumber(num.toString())} className={`py-3.5 rounded-xl text-xs transition-all ${tableNumber === num.toString() ? 'bg-[#FF8000] text-white border-orange-600 shadow-md' : 'bg-white text-[#666666] border border-gray-100'}`}>{num}</button>
                        ))}</div>
                      </div>
                    )}

                    {orderType === 'delivery' && (
                      <div className="space-y-3">
                        <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Endereço Completo</p>
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="RUA, NÚMERO, BAIRRO..." className="w-full bg-white border-2 rounded-2xl px-6 py-5 text-xs outline-none h-28 resize-none shadow-sm focus:border-[#FF8000] transition-all"/>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-[9px] tracking-[0.3em] text-[#666666] ml-2">Como vai Pagar?</p>
                      <div className="grid grid-cols-3 gap-2">{(['Pix', 'Dinheiro', 'Cartão'] as const).map(method => (
                        <button key={method} onClick={() => setPaymentMethod(method)} className={`py-4 rounded-2xl text-[10px] border-2 transition-all ${paymentMethod === method ? 'bg-[#FF8000] text-white border-[#FF8000] shadow-lg' : 'bg-white text-[#666666] border-gray-100'}`}>{method}</button>
                      ))}</div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="TEM UM CUPOM?" className="flex-1 bg-white border-2 rounded-2xl px-6 py-5 text-[11px] outline-none shadow-sm focus:border-[#FF8000] transition-all uppercase tracking-widest"/>
                      <button onClick={handleValidateCoupon} className="bg-gray-900 text-[#FF8000] px-8 py-5 rounded-2xl text-[11px] shadow-xl active:scale-95 transition-all">OK</button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <p className="text-[11px] font-black uppercase text-[#666666] tracking-[0.25em] ml-6">Seus Itens de Jú</p>
                    {items.map(item => (
                      <div key={item.id} className="flex gap-5 bg-white p-5 rounded-[2.5rem] border items-center relative group shadow-sm hover:border-black transition-all overflow-hidden">
                        <button onClick={() => onRemove(item.id)} className="absolute top-5 right-5 text-red-300 p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all z-10">
                          <TrashIcon size={18} />
                        </button>
                        
                        <img src={item.image} className="w-20 h-20 rounded-3xl object-cover shrink-0 shadow-sm" />
                        
                        <div className="flex-1 font-black min-w-0 pr-10">
                          <h4 className="text-[13px] uppercase leading-none truncate mb-2">{item.name}</h4>
                          <p className="text-[#FF8000] text-[15px] italic tracking-tighter">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                          
                          <div className="mt-4 flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl font-black w-fit border border-gray-100">
                            <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-100 transition-all text-xl">-</button>
                            <span className="text-[13px] w-8 text-center">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-100 transition-all text-xl">+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-40 opacity-20 grayscale">
                  <div className="w-24 h-24 border-8 border-dashed border-gray-900 rounded-full mb-8 animate-[spin_12s_linear_infinite]"></div>
                  <p className="font-black uppercase text-[12px] tracking-[0.3em] text-center">Sua sacola está aguardando<br/>uma delícia caseira!</p>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-10 border-t-8 border-gray-50 bg-white sticky bottom-0 rounded-t-[4rem] z-20 font-black italic shadow-[0_-30px_60px_-15px_rgba(255,128,0,0.15)]">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <span className="text-[10px] text-[#666666] not-italic uppercase tracking-[0.25em] mb-1 block">Total da Sacola</span>
                    <span className="text-5xl block tracking-tighter leading-none">R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {discount > 0 && (
                    <div className="text-right">
                      <span className="text-green-600 text-lg block font-black">- R$ {discount.toFixed(2).replace('.', ',')}</span>
                      <span className="text-[10px] text-gray-300 not-italic uppercase font-black tracking-widest">Cupom Jú</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleCheckout} 
                  disabled={isProcessing} 
                  className="w-full bg-gray-900 text-[#FF8000] py-7 rounded-[2.5rem] uppercase text-[13px] font-black tracking-[0.25em] shadow-2xl active:scale-95 transition-all hover:brightness-125 flex items-center justify-center gap-4"
                >
                  {isProcessing ? 'Enviando...' : 'Finalizar Pedido ✨'}
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
