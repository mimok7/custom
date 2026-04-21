'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ToastPayload, ToastType } from '@/lib/toast';

interface ToastItem extends ToastPayload {
  id: number;
}

const ICONS: Record<ToastType, string> = {
  info:    'ℹ️',
  success: '✅',
  warning: '⚠️',
  error:   '❌',
};

const BG: Record<ToastType, string> = {
  info:    'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  error:   'bg-red-600',
};

let idSeq = 0;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<ToastPayload>).detail;
      const id = ++idSeq;
      const duration = payload.duration ?? 5000;

      setToasts((prev) => [...prev, { ...payload, id }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    };

    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, [dismiss]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 w-[min(360px,92vw)]"
          >
            {toasts.map((toast) => {
              const type = toast.type ?? 'info';
              return (
                <div
                  key={toast.id}
                  role="alert"
                  className={`flex items-start gap-3 rounded-xl shadow-lg text-white px-4 py-3 ${BG[type]} animate-fade-in`}
                >
                  <span className="text-lg leading-none mt-0.5 shrink-0">{ICONS[type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug break-words">{toast.message}</p>
                    {toast.onRetry && (
                      <button
                        type="button"
                        onClick={() => { toast.onRetry?.(); dismiss(toast.id); }}
                        className="mt-1.5 text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
                      >
                        페이지 새로고침
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="닫기"
                    className="shrink-0 opacity-70 hover:opacity-100 text-white text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
