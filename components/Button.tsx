
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'mono';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:pointer-events-none select-none';

  const variants: Record<string, string> = {
    primary:   'btn-accent',
    mono:      'btn-mono',
    secondary: 'btn-ghost',
    danger:    'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 active:scale-[0.98]',
    ghost:     'bg-transparent text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] active:scale-[0.98]',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8 px-3 text-[12px] gap-1.5',
    md: 'h-9 px-4 text-[13px] gap-2',
    lg: 'h-11 px-5 text-[14px] gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
