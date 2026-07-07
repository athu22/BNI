import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = {
    toast: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center p-4 min-w-[300px] max-w-md rounded-xl shadow-lg border backdrop-blur-md ${
                t.type === 'success' 
                  ? 'bg-green-50/90 border-green-200 text-green-800' 
                  : t.type === 'error'
                  ? 'bg-red-50/90 border-red-200 text-red-800'
                  : 'bg-white/90 border-gray-200 text-gray-800'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-3 text-green-600 shrink-0" />}
              {t.type === 'error' && <XCircle className="w-5 h-5 mr-3 text-red-600 shrink-0" />}
              {t.type === 'info' && <Info className="w-5 h-5 mr-3 text-blue-600 shrink-0" />}
              
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              
              <button 
                onClick={() => removeToast(t.id)}
                className="ml-4 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
