interface SectionTitleProps {
  title: string
  subtitle?: string
  light?: boolean
  variant?: 'iasd' | 'vidasaude'
}

export default function SectionTitle({
  title,
  subtitle,
  light = false,
  variant = 'iasd',
}: SectionTitleProps) {
  const darkTitle = variant === 'vidasaude' ? 'text-vidasaude-red' : 'text-iasd-dark'
  const revealBg = variant === 'vidasaude' ? 'bg-vidasaude-ink' : 'bg-iasd-dark'
  return (
    <div data-aos="fade-up" className="mb-12 text-center">
      <h2
        className={`font-heading text-4xl md:text-5xl font-bold ${
          light ? 'text-white' : darkTitle
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <div className="relative mt-2 inline-block">
          <p className={`text-lg ${light ? 'text-gray-300' : 'text-gray-600'}`}>{subtitle}</p>
          <div
            className={`absolute inset-0 ${light ? revealBg : 'bg-white'} animate-reveal-width`}
          />
        </div>
      )}
    </div>
  )
}
