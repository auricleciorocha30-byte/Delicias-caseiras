
import React from 'react';
import { STORE_INFO } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-[#FFF9E5] pt-14 pb-16 px-6 rounded-b-[4rem] relative overflow-hidden">
      {/* Background Decorativo suave */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF7F11]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Container do Logo Ju Marmitas Caseiras */}
        <div className="mb-6 flex flex-col items-center">
          <div className="bg-[#FF7F11] w-24 h-24 rounded-full shadow-lg flex items-center justify-center p-4 mb-2">
            <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
              {/* Garfo */}
              <path d="M35 15v30c0 5 3 8 7 8h2v32h6V53h2c4 0 7-3 7-8V15h-3v25h-2V15h-3v25h-2V15h-3v25h-2V15h-3z" />
              {/* Colher */}
              <path d="M60 15c-6 0-11 6-11 13 0 5 3 9 7 11v46h8V39c4-2 7-6 7-11 0-7-5-13-11-13z" />
            </svg>
          </div>
          <h2 className="text-5xl font-extrabold text-[#1A1A1A] tracking-tighter leading-none mb-0">Ju</h2>
          <span className="text-lg font-bold text-[#6C7A1D] uppercase tracking-widest -mt-1">Marmitas Caseiras</span>
        </div>
        
        {/* Título Principal Estilizado com Espaçamento Ajustado */}
        <div className="mb-10">
          <h1 className="text-6xl md:text-7xl font-black text-[#FF7F11] italic uppercase tracking-tighter leading-[0.95] mb-0 drop-shadow-sm">
            MARMITA <br/> 
            <span className="text-[#6C7A1D] lowercase font-serif italic text-4xl md:text-5xl normal-case block translate-x-12 -mt-3 drop-shadow-none">
              fit
            </span>
          </h1>
          <p className="text-[#1A1A1A] font-bold text-xs mt-6 uppercase tracking-widest opacity-80">
            Saúde que cabe no potinho.
          </p>
        </div>
        
        {/* Horário */}
        <div className="bg-[#FF7F11]/10 text-[#FF7F11] px-6 py-2 rounded-full inline-flex items-center gap-2 border border-[#FF7F11]/20">
          <span className="w-2 h-2 bg-[#FF7F11] rounded-full animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{STORE_INFO.hours}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
