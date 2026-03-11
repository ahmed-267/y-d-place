
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Camera, Check, AlertCircle } from 'lucide-react';

interface ScanProgressModalProps {
  isOpen: boolean;
  status: 'uploading' | 'analyzing' | 'extracting' | 'finishing' | 'error' | 'success' | 'timeout';
  imageThumbnail?: string | null;
  onClose?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({ 
  isOpen, 
  status, 
  imageThumbnail,
  onClose,
  onCancel,
  onRetry
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    let interval: NodeJS.Timeout;
    
    if (status === 'uploading') {
      interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 30));
      }, 100);
    } else if (status === 'analyzing') {
      interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 60));
      }, 200);
    } else if (status === 'extracting') {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev < 85) return prev + 1;
          // Slowly animate from 85% to 95% over 10 seconds if still extracting
          if (prev < 95) return prev + 0.1;
          return prev;
        });
      }, 300);
    } else if (status === 'finishing' || status === 'success') {
      setProgress(100);
    }

    return () => clearInterval(interval);
  }, [isOpen, status]);

  const getStatusText = () => {
    switch (status) {
      case 'uploading': return 'Uploading image...';
      case 'analyzing': return 'Analysing menu structure...';
      case 'extracting': return 'Extracting items and prices...';
      case 'finishing': return 'Finishing up...';
      case 'timeout': return 'Scan is taking too long';
      case 'error': return 'Something went wrong';
      case 'success': return 'Scan complete!';
      default: return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    if (status === 'error' || status === 'timeout') return <AlertCircle className="text-rose-500" size={32} />;
    if (status === 'success') return <Check className="text-emerald-500" size={32} />;
    return <Loader2 className="text-bakery-brown animate-spin" size={32} />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bakery-brown/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-bakery-beige/30 flex items-center justify-center overflow-hidden">
                  {imageThumbnail ? (
                    <img src={imageThumbnail} alt="Thumbnail" className="w-full h-full object-cover opacity-50" />
                  ) : (
                    <Camera className="text-bakery-brown/20" size={40} />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                  {getStatusIcon()}
                </div>
              </div>

              <div className="space-y-2 w-full">
                <h3 className="text-xl font-black font-serif text-bakery-brown">{getStatusText()}</h3>
                <p className="text-sm text-bakery-brown/50">
                  {status === 'timeout' 
                    ? 'Please try again with a clearer image.' 
                    : 'Please wait while our AI processes your request.'}
                </p>
              </div>

              <div className="w-full space-y-2">
                <div className="h-3 w-full bg-bakery-beige/30 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-bakery-brown"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-bakery-brown/30">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                {status === 'timeout' && (
                  <button 
                    onClick={onRetry}
                    className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all"
                  >
                    Retry Scan
                  </button>
                )}
                
                {(status === 'error' || status === 'timeout') ? (
                  <button 
                    onClick={onClose}
                    className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                  >
                    Cancel
                  </button>
                ) : (
                  status !== 'success' && (
                    <button 
                      onClick={onCancel}
                      className="w-full py-4 bg-bakery-beige/30 text-bakery-brown/60 rounded-2xl font-bold hover:bg-bakery-beige/50 transition-all"
                    >
                      Cancel Scan
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-bakery-accent/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-bakery-caramel/10 rounded-full blur-2xl pointer-events-none" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};