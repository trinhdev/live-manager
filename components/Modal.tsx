
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // Trap body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog */}
      <div
        className={`
          relative z-10 w-full ${maxWidths[size]}
          bg-white
          border border-[#E5E5E5]
          rounded-t-2xl sm:rounded-2xl
          shadow-[0_20px_60px_rgba(0,0,0,0.14),0_4px_16px_rgba(0,0,0,0.06)]
          animate-fade-in
          overflow-hidden
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F5F5F5]">
          <div>
            <h3 className="text-[15px] font-700 text-[#171717] tracking-tight font-bold">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A3A3A3] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
            aria-label="Đóng"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[78vh] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
