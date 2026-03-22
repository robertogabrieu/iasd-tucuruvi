import SectionTitle from './SectionTitle'

export default function AoVivo() {
  return (
    <section id="ao-vivo" className="bg-iasd-dark py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Ao Vivo" subtitle="Acompanhe nossos cultos" light />
        <div data-aos="zoom-in" className="mx-auto max-w-4xl">
          <div className="relative aspect-video overflow-hidden rounded-lg shadow-2xl">
            <iframe
              src="https://www.youtube.com/embed?listType=user_uploads&list=IASDTucuruviOficial"
              title="Transmissão ao vivo — IASD Tucuruvi"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Acompanhe também pelo nosso{' '}
            <a
              href="https://www.youtube.com/@IASDTucuruviOficial"
              target="_blank"
              rel="noopener noreferrer"
              className="text-iasd-accent hover:underline"
            >
              canal no YouTube
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
