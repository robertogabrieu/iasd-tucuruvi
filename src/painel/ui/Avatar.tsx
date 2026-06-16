function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

const sizes = {
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
}

/** Círculo com as iniciais do nome. */
export default function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof sizes }) {
  return (
    <div className={`${sizes[size]} rounded-full bg-iasd-dark text-white flex items-center justify-center font-heading font-bold shrink-0`}>
      {initials(name)}
    </div>
  )
}
