
import React, { useRef, useState } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '../AppContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger'
}) => {
  const { t, addToast } = useApp();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (!isOpen) return null;
  const confirm = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      if (await onConfirm() !== false) onClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Action failed. Please retry.', 'error');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const resolvedCancel = cancelText || t('cancel');
  const resolvedConfirm = confirmText || (type === 'danger' ? t('delete') : t('confirm'));

  return (
    <Modal title={title} onClose={() => { if (!running.current) onClose(); }}>
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
          <div className={`p-2 rounded-xl shrink-0 ${type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <p className="text-bakery-brown/80 font-medium leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-bakery-beige text-bakery-brown rounded-xl font-bold hover:bg-bakery-beige/80 transition-all active:scale-95"
          >
            {resolvedCancel}
          </button>
          <button
            disabled={busy}
            onClick={() => void confirm()}
            className={`flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all active:scale-95 shadow-lg ${
              type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
            }`}
          >
            {busy ? 'Saving…' : resolvedConfirm}
          </button>
        </div>
      </div>
    </Modal>
  );
};
