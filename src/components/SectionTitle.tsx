interface SectionTitleProps {
  title: string
  subtitle?: string
  light?: boolean
  variant?: 'iasd' | 'antares' | 'kids' | 'vidasaude' | 'asa'
  /** Cor do fundo da seção — a cortina do subtítulo precisa cobri-lo ao revelar o texto. */
  revealBg?: string
}

export default function SectionTitle({
  title,
  subtitle,
  light = false,
  variant = 'iasd',
  revealBg,
}: SectionTitleProps) {
  const darkTitle =
    variant === 'antares'
      ? 'text-antares-red'
      : variant === 'kids'
        ? 'text-kids-wine'
        : variant === 'vidasaude'
          ? 'text-vidasaude-red'
          : variant === 'asa'
            ? 'text-asa-ink'
            : 'text-iasd-dark'
  const fundoDaVariante =
    variant === 'antares'
      ? 'bg-antares-ink'
      : variant === 'kids'
        ? 'bg-kids-ink'
        : variant === 'vidasaude'
          ? 'bg-vidasaude-ink'
          : variant === 'asa'
            ? 'bg-asa-ink'
            : 'bg-iasd-dark'
  const curtain = revealBg ?? (light ? fundoDaVariante : 'bg-white')
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
            className={`absolute inset-0 ${curtain} animate-reveal-width`}
          />
        </div>
      )}
    </div>
  )
}
