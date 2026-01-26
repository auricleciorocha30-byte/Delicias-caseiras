
import React from 'react';
import { Product, Coupon } from '../types';

interface MenuItemProps {
  product: Product;
  onAdd: (product: Product) => void;
  activeCoupons: Coupon[];
}

const MenuItem: React.FC<MenuItemProps> = ({ product, onAdd, activeCoupons }) => {
  const isKit = product.category === 'Kits & Planos';
  const isAvailable = product.isAvailable !== false;

  // CORREÇÃO: Lógica de exibição de desconto específica para o item
  const validCoupons = activeCoupons.filter(c => {
    if (!c.isActive) return false;
    if (c.scopeType === 'all') return true;
    
    if (c.scopeType === 'category') {
       return (c.scopeValue || '').toLowerCase().trim() === product.category.toLowerCase().trim();
    }
    if (c.scopeType === 'product') {
       return (c.scopeValue || '').trim() === product.id.trim();
    }
    
    return false;
  });

  const applicableCoupon = validCoupons.length > 0 
    ? validCoupons.reduce((prev, curr) => (curr.percentage > prev.percentage) ? curr : prev)
    : null;

  const savingsValue = applicableCoupon 
    ? (product.price * (applicableCoupon.percentage / 100)) 
    : 0;

  return (
    <div className={`group bg-white rounded-[2.5rem] shadow-sm border overflow-hidden flex flex-col relative transition-all duration-300 ${!isAvailable ? 'opacity-70' : 'hover:shadow-xl hover:-translate-y-1'} ${isKit ? 'border-[#FF7F11] border-2 ring-4 ring-[#FF7F11]/5' : 'border-gray-100'}`}>
      {isKit && isAvailable && (
        <div className="absolute top-5 left-5 z-10 bg-[#FF7F11] text-white text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-lg tracking-widest animate-pulse">
          PLANO MENSAL ⭐
        </div>
      )}

      {applicableCoupon && isAvailable && (
        <div className="absolute top-5 right-5 z-10 bg-[#6C7A1D] text-white text-[9px] font-black uppercase px-4 py-2 rounded-full shadow-lg border-b-4 border-[#4A5514] tracking-widest">
          {applicableCoupon.percentage}% OFF 🎫
        </div>
      )}

      {!isAvailable && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-8 text-center">
          <div className="bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.25em] px-8 py-4 rounded-full shadow-2xl mb-2">
            Esgotado 🚫
          </div>
          <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.2em]">Reposição em breve</p>
        </div>
      )}
      
      <div className="aspect-[4/3] overflow-hidden relative bg-gray-50">
        <img 
          src={product.image} 
          alt={product.name} 
          className={`w-full h-full object-cover transition-transform duration-1000 ${!isAvailable ? 'grayscale scale-105' : 'group-hover:scale-110'}`}
        />
        {isAvailable && (
          <div className={`absolute bottom-4 right-4 ${isKit ? 'bg-[#FF7F11]' : 'bg-[#1A1A1A]'} text-white font-black px-5 py-2 rounded-2xl text-[18px] shadow-2xl tracking-tighter italic border-2 border-white/20`}>
            R$ {product.price.toFixed(2).replace('.', ',')}
          </div>
        )}
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <h3 className={`font-extrabold text-[#1A1A1A] text-xl mb-2 leading-none uppercase tracking-tighter ${isKit ? 'text-[#FF7F11]' : ''}`}>
          {product.name}
        </h3>
        <p className="text-gray-500 text-xs mb-6 flex-1 line-clamp-3 leading-relaxed font-medium">
          {product.description}
        </p>
        
        {(product.savings || savingsValue > 0) && isAvailable && (
          <div className="mb-5">
            <span className="bg-[#6C7A1D]/10 text-[#6C7A1D] text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 w-fit border border-[#6C7A1D]/20">
              <span className="w-2 h-2 bg-[#6C7A1D] rounded-full"></span>
              {product.savings || `Poupe R$ ${savingsValue.toFixed(2).replace('.', ',')}`}
            </span>
          </div>
        )}
        
        <button 
          onClick={() => isAvailable && onAdd(product)}
          disabled={!isAvailable}
          className={`w-full ${!isAvailable ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : isKit ? 'bg-[#FF7F11] text-white shadow-[#FF7F11]/20' : 'bg-[#1A1A1A] text-white'} font-black py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl ${isAvailable ? 'hover:brightness-110' : ''}`}
        >
          <span className="text-[11px] uppercase tracking-[0.2em]">
            {isKit ? 'Assinar Plano' : 'Adicionar ao Carrinho'}
          </span>
          {isAvailable && (
            <svg width="22" height="22" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default MenuItem;
