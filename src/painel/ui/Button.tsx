import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}
const variants: Record<Variant, string> = {
  primary: 'bg-iasd-dark text-white hover:bg-iasd-accent',
  secondary: 'border border-iasd-dark text-iasd-dark hover:bg-gray-100',
  danger: 'border border-red-200 text-red-700 hover:bg-red-50',
  ghost: 'text-iasd-dark hover:bg-gray-100',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  /** Quando presente, o botão vira um <Link> do React Router com o mesmo estilo. */
  to?: string
  icon?: ReactNode
  full?: boolean
}

/** Botão padrão da área administrativa. Vira link quando recebe `to`. */
export default function Button({ variant = 'primary', size = 'md', to, icon, full, className = '', children, ...rest }: Props) {
  const cls = buttonClass(variant, size, `${full ? 'w-full' : ''} ${className}`)
  if (to) {
    return <Link to={to} className={cls}>{icon}{children}</Link>
  }
  return <button className={cls} {...rest}>{icon}{children}</button>
}
