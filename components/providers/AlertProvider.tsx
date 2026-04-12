'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const brandName = '스테이 하롱 트레블';

  useEffect(() => {
    const original = window.alert;
    window.alert = (msg?: unknown) => {
      setMessage(typeof msg === 'string' ? msg : String(msg ?? ''));
    };
    return () => {
      window.alert = original;
    };
  }, []);

  const close = () => setMessage(null);

  return (
    <>
      {children}
      {message !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45"
            onClick={close}
            role="presentation"
          >
            <div
              className="w-[min(420px,92vw)] bg-white rounded-xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="알림"
            >
              <div className="bg-blue-600 text-white px-4 py-3 font-bold text-base">
                {brandName}
              </div>
              <div className="px-4 py-5 text-gray-900 leading-relaxed whitespace-pre-wrap">
                {message}
              </div>
              <div className="px-4 py-3 flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={close}
                >
                  확인
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
