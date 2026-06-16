'use client';

// 轻量 UI 基础组件（shadcn 风格，hand-rolled，无 radix 依赖）
import { X } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
};

export function Button({ variant = 'default', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-9 px-4 text-sm',
        size === 'icon' && 'h-9 w-9 p-0 text-sm',
        variant === 'default' && 'bg-neutral-900 text-white hover:bg-neutral-700',
        variant === 'outline' &&
          'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100',
        variant === 'ghost' && 'text-neutral-600 hover:bg-neutral-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm',
        'placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
        tone === 'neutral' && 'bg-neutral-100 text-neutral-600',
        tone === 'green' && 'bg-green-100 text-green-700',
        tone === 'amber' && 'bg-amber-100 text-amber-700',
        tone === 'red' && 'bg-red-100 text-red-700',
        tone === 'blue' && 'bg-blue-100 text-blue-700',
        tone === 'purple' && 'bg-purple-100 text-purple-700',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className={cn('relative z-10 w-full rounded-lg bg-white p-5 shadow-xl', width)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            className="text-neutral-400 hover:text-neutral-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-neutral-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
            value === tab.key
              ? 'border-neutral-900 font-medium text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
