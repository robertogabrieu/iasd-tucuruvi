import SectionTitle from './SectionTitle'

export default function Sobre() {
  return (
    <section id="sobre" className="bg-white py-20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Quem Somos" subtitle="Conheça a IASD Tucuruvi" />
        <div className="grid gap-12 md:grid-cols-2">
          <div data-aos="zoom-in">
            <p className="text-gray-700 leading-relaxed">
              Há mais de 70 anos, a Igreja Adventista do Sétimo Dia no Tucuruvi é um lugar onde
              você pode sentir, se aprofundar, celebrar e compartilhar o amor de Jesus. Nossa
              comunidade é acolhedora e comprometida com a missão de levar esperança e
              transformação à vida das pessoas.
            </p>
          </div>
          <div data-aos="zoom-in" data-aos-delay="150">
            <h3 className="font-heading text-xl font-bold text-iasd-dark">Horários de Culto</h3>
            <ul className="mt-4 space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div><strong>Sábado — Escola Sabatina:</strong> 9h00</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div><strong>Sábado — Culto Divino:</strong> 11h15</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-iasd-accent" />
                <div><strong>Quarta-feira — Culto de Oração:</strong> 19h30</div>
              </li>
            </ul>
          </div>
        </div>
        <div data-aos="zoom-in" className="mt-12">
          <iframe
            title="Localização IASD Tucuruvi"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.123!2d-46.606!3d-23.472!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zIASD+Tucuruvi!5e0!3m2!1spt-BR!2sbr"
            className="h-64 w-full rounded-lg shadow-lg"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
