
import React from 'react';
import { STORE_INFO } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-[#FF8000] pt-14 pb-20 px-6 rounded-b-[4.5rem] shadow-2xl relative overflow-hidden">
      {/* Background Decorativo suave */}
      <div className="absolute top-[-15%] right-[-5%] w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-60 h-60 bg-black/5 rounded-full blur-2xl"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Container do Logo (Círculo Branco) */}
        <div className="bg-white w-32 h-32 rounded-full mb-8 shadow-2xl flex items-center justify-center p-3 border-4 border-white/40 transform hover:scale-105 transition-all duration-500">
          <div className="w-full h-full relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* O gancho estilizado do 'J' / 'D' (Laranja) */}
              <path 
                d="M42,5 C42,5 65,30 55,65 C48,85 15,85 10,65 C5,45 15,25 42,25 L42,32 C25,32 18,48 18,60 C18,75 40,75 45,65 C50,55 42,25 42,5 Z" 
                fill="#FF8000"
              />
              
              {/* Faca (Cinza) - Posicionada horizontalmente acima do garfo */}
              <path 
                d="M15,45 L50,45 C54,45 56,46 56,47.5 C56,49 54,50 50,50 L15,50 Z" 
                fill="#666666" 
              />
              
              {/* Garfo (Laranja) - Posicionado horizontalmente dentro do gancho */}
              <g fill="#FF8000">
                {/* Cabo do garfo */}
                <rect x="35" y="58" width="18" height="3" rx="1" />
                {/* Base dos dentes */}
                <path d="M28,56 L35,56 L35,63 L28,63 C23,63 23,56 28,56 Z" />
                {/* Dentes do garfo */}
                <rect x="14" y="56.5" width="14" height="1.2" rx="0.5" />
                <rect x="14" y="59" width="14" height="1.2" rx="0.5" />
                <rect x="14" y="61.5" width="14" height="1.2" rx="0.5" />
              </g>
              
              {/* Barra Vertical Grossa (Cinza) - Representa o lado direito do 'U' de JU */}
              <rect x="65" y="22" width="18" height="58" rx="5" fill="#666666" />
            </svg>
          </div>
        </div>
        
        {/* Textos Institucionais */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none drop-shadow-lg">
            JU DELÍCIAS CASEIRAS
          </h1>
          <div className="flex flex-col items-center">
            <p className="text-white/95 font-bold uppercase tracking-[0.25em] text-[9px] max-w-[300px] leading-relaxed">
              {STORE_INFO.slogan}
            </p>
            <div className="h-1 w-12 bg-white/40 rounded-full mt-5"></div>
          </div>
        </div>
        
        {/* Badge de Horário e Status */}
        <div className="mt-10 bg-black/20 backdrop-blur-xl text-white px-8 py-3.5 rounded-full inline-flex items-center gap-4 border border-white/20 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_15px_#4ade80]"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">{STORE_INFO.hours}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
