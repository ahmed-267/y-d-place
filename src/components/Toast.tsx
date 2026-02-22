
import React from 'react';
import { useApp } from '../AppContext';

export const Toast = () => {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`p-4 rounded-xl shadow-lg flex items-center gap-3 min-w-[250px] transition-all animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 
            toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-bakery-caramel text-white'
          }`}
        >
          <span className="font-bold">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
