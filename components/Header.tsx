
import React from 'react';
import { STORE_INFO } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-brand-orange pt-14 pb-16 px-6 rounded-b-[4rem] relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="mb-6 flex flex-col items-center">
          <div className="bg-white w-24 h-24 rounded-full shadow-lg flex items-center justify-center p-4 mb-2 border-4 border-brand-green/20">
             <span className="text-brand-orange text-4xl font-black italic leading-none">Ju</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tighter leading-none mb-0 uppercase">Marmitas Caseiras</h2>
          <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] mt-1">Sabor que acolhe</span>
        </div>
        
        <div className="mb-10">
          <h1 className="text-6xl md:text-7xl font-black text-brand-dark italic uppercase tracking-tighter leading-[0.95] mb-0 drop-shadow-sm">
            CARDÁPIO <br/> 
            <span className="text-white bg-brand-green px-4 py-1 lowercase font-serif italic text-4xl md:text-5xl normal-case inline-block rotate-2 -mt-3 shadow-xl">
              artesanal
            </span>
          </h1>
          <p className="text-white font-black text-xs mt-6 uppercase tracking-widest opacity-90">
            {STORE_INFO.slogan}
          </p>
        </div>
        
        <div className="bg-brand-dark text-brand-orange px-6 py-2 rounded-full inline-flex items-center gap-2 border border-white/10 shadow-lg">
          <span className="w-2 h-2 bg-brand-orange rounded-full animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{STORE_INFO.hours}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
