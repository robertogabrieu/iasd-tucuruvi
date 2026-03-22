interface SectionTitleProps {
  title: string
  subtitle?: string
  light?: boolean
}

export default function SectionTitle({ title, subtitle, light = false }: SectionTitleProps) {
  return (
    <div data-aos="fade-right" className="mb-12">
      <h2
        className={`font-heading text-4xl md:text-5xl font-bold ${
          light ? 'text-white' : 'text-iasd-dark'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <div className="relative mt-2 inline-block">
          <p className={`text-lg ${light ? 'text-gray-300' : 'text-gray-600'}`}>{subtitle}</p>
          <div
            className={`absolute inset-0 ${light ? 'bg-iasd-dark' : 'bg-white'} animate-reveal-width`}
          />
        </div>
      )}
    </div>
  )
}
