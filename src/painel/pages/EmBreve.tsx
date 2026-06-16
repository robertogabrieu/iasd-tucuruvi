import { EmptyState } from '@/painel/ui'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

export default function EmBreve() {
  return (
    <EmptyState
      icon={<ClockIcon />}
      title="Em breve"
      description="Esta seção ainda não foi implementada."
    />
  )
}
