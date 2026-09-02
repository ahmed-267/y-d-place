import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export const Modal = ({ title, children, onClose, size = 'md' }: ModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-bakery-brown/40 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
        style={{ width: '100vw', height: '100vh' }}
      />

      <div
        className={`relative bg-white w-full ${SIZE_CLASS[size]} rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-bakery-beige flex justify-between items-center shrink-0 bg-white z-10">
          <h3 className="text-lg sm:text-xl font-bold font-serif text-bakery-brown">{title}</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-bakery-brown/40 hover:text-bakery-brown hover:bg-bakery-beige/50 transition-all"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto scrollbar-hide flex-1 bg-white">{children}</div>
      </div>
    </div>,
    document.body
  );
};
