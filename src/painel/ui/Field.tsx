import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

const control = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-iasd-accent/40 focus:border-iasd-accent disabled:bg-gray-100'

/** Wrapper de campo: label + controle + mensagem de erro. */
export function Field({ label, error, children, htmlFor }: { label?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      {label && <label htmlFor={htmlFor} className="block text-sm text-gray-600 mb-1">{label}</label>}
      {children}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${control} ${className}`} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...props }, ref) {
    return <select ref={ref} className={`${control} ${className}`} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${control} ${className}`} {...props} />
  },
)
