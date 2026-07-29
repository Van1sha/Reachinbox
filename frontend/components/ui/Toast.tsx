'use client';

import { useEffect, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastListeners: Array<(toast: Toast) => void> = [];

export function showToast(message: string, type: Toast['type'] = 'info') {
  const toast: Toast = { id: Date.now().toString(), message, type };
  toastListeners.forEach((l) => l(toast));
}

const icons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

const colors = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  info: 'border-indigo-500/30 bg-indigo-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl glass border ${colors[toast.type]} animate-slide-in-right shadow-lg`}
        >
          <span className="text-lg shrink-0">{icons[toast.type]}</span>
          <p className="text-sm text-gray-200">{toast.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="ml-auto text-gray-500 hover:text-gray-300 shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
