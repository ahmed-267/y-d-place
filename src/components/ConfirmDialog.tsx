
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  requireReset?: boolean;
}

export const ConfirmDialog = ({ title, message, onConfirm, onCancel, requireReset = false }: ConfirmDialogProps) => {
  const [input, setInput] = useState('');
  const { t } = useApp();
  
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-6 text-bakery-brown/80">{message}</p>
      {requireReset && (
        <input 
          type="text" 
          placeholder={t('confirmReset')}
          className="w-full p-3 border border-bakery-beige rounded-xl mb-6 focus:ring-2 focus:ring-bakery-caramel outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
      )}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 p-3 rounded-xl bg-bakery-beige text-bakery-brown font-bold transition-colors hover:bg-bakery-beige/80">
          {t('cancel')}
        </button>
        <button 
          disabled={requireReset && input !== 'RESET'}
          onClick={onConfirm} 
          className={`flex-1 p-3 rounded-xl text-white font-bold transition-all ${
            requireReset ? 'bg-rose-500 hover:bg-rose-600' : 'bg-bakery-brown hover:bg-bakery-brown/90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {t('confirm')}
        </button>
      </div>
    </Modal>
  );
};
