
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export const Modal = ({ title, children, onClose }: ModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-bakery-beige flex justify-between items-center">
          <h3 className="text-xl font-bold font-serif">{title}</h3>
          <button onClick={onClose} className="text-bakery-brown/50 hover:text-bakery-brown transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
};
