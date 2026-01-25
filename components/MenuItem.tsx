
import React from 'react';
import { Product, Coupon } from '../types';

interface MenuItemProps {
  product: Product;
  onAdd: (product: Product) => void;
  activeCoupons: Coupon[];
}

const MenuItem: React.FC<MenuItemProps> = ({ product, onAdd, activeCoupons }) => {
  const isCombo = product.category === 'Combos';
  const isAvailable = product.isAvailable !== false;

  const validCoupons = activeCoupons.filter(c => {
    if (!c.isActive) return false;
    if (c.scopeType === 'all') return true;
    
    const scopeValues = (c.scopeValue || '').split(',');
    if (c.scopeType === 'product') return scopeValues.includes(product.id);
    if (c.scopeType === 'category') return scopeValues.includes(product.category);
    
    return false;
  });

  const applicableCoupon = validCoupons.length > 0 
    ? validCoupons.reduce((prev, curr) => (curr.percentage > prev.percentage) ? curr : prev)
    : null;

  const savingsValue = applicableCoupon 
    ? (product.price * (applicableCoupon.percentage / 100)) 
    : 0;

  return (
    <div className={`group bg-white rounded-[2.5rem] shadow-sm border overflow-hidden flex flex-col relative transition-all duration-300 ${!isAvailable ? 'opacity-70' : 'hover:shadow-2xl hover:-translate-y-1'} ${isCombo ? 'border-[#FF8000] border-2 shadow-orange-100' : 'border-gray-100'}`}>
      {isCombo && isAvailable && (
        <div className="absolute top-5 left-5 z-10 bg-gray-900 text-[#FF8000] text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-lg tracking-widest">
          Combo Jú 🔥
        </div>
      )}

      {applicableCoupon && isAvailable && (
        <div className="absolute top-5 right-5 z-10 bg-green-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 border-b-4 border-green-800 tracking-widest">
          <span>{applicableCoupon.percentage}% OFF</span> 🎫
        </div>
      )}

      {!isAvailable && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-8 text-center">
          <div className="bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.25em] px-8 py-4 rounded-full shadow-2xl mb-2 animate-pulse">
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
          <div className={`absolute bottom-4 right-4 ${isCombo ? 'bg-gray-900 text-[#FF8000]' : 'bg-[#FF8000] text-white'} font-black px-5 py-2 rounded-2xl text-[15px] shadow-2xl tracking-tighter italic border-2 border-white/20`}>
            R$ {product.price.toFixed(2).replace('.', ',')}
          </div>
        )}
      </div>
      
      <div className="p-8 flex flex-col flex-1">
        <h3 className="font-extrabold text-gray-900 text-xl mb-2 leading-none uppercase italic tracking-tighter">{product.name}</h3>
        <p className="text-[#666666] text-xs mb-6 flex-1 line-clamp-3 leading-relaxed font-medium">{product.description}</p>
        
        {savingsValue > 0 && isAvailable && (
          <div className="mb-5">
            <span className="bg-green-100 text-green-700 text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 w-fit border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Poupe R$ {savingsValue.toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}
        
        <button 
          onClick={() => isAvailable && onAdd(product)}
          disabled={!isAvailable}
          className={`w-full ${!isAvailable ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : isCombo ? 'bg-gray-900 text-white' : 'bg-[#FF8000] text-white'} font-black py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl ${isAvailable ? 'hover:brightness-110' : ''}`}
        >
          <span className="text-[11px] uppercase tracking-[0.2em]">
            {!isAvailable ? 'Aguarde Reposição' : isCombo ? 'Escolher Combo' : 'Adicionar'}
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
