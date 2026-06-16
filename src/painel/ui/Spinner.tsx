/** Indicador de carregamento circular. Use para listagens e mídias em carregamento. */
export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <span role="status" aria-label="Carregando"
      className={`inline-block w-6 h-6 rounded-full border-2 border-gray-300 border-t-iasd-accent animate-spin ${className}`} />
  )
}
