"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: null,
    resolve: null,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const confirm = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  };

  const handleClose = (value: boolean) => {
    if (state.resolve) {
      state.resolve(value);
    }
    setState({
      open: false,
      options: null,
      resolve: null,
    });
  };

  const getIcon = (type?: 'danger' | 'warning' | 'info') => {
    switch (type) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>
        );
      case 'info':
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-500 flex items-center justify-center shadow-xs">
            <Info className="w-6 h-6" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
            <HelpCircle className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {mounted && state.open && state.options &&
        createPortal(
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => handleClose(false)}
          >
            <div 
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  {getIcon(state.options.type)}
                  <div>
                    <h3 className="font-extrabold text-slate-850 text-base">
                      {state.options.title || 'Are you sure?'}
                    </h3>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">
                      Confirm Action
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleClose(false)}
                  className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-line">
                  {state.options.message}
                </p>
              </div>

              {/* Actions */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs transition-colors border border-slate-150 cursor-pointer"
                >
                  {state.options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-white text-xs transition-all shadow-md cursor-pointer ${
                    state.options.type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-[#ed5c37] hover:bg-[#d94f2c] shadow-[#ed5c37]/20'
                  }`}
                >
                  {state.options.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </ConfirmContext.Provider>
  );
}
