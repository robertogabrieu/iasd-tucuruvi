import { Link } from '@/lib/navigation'
import { dataLongaDoEvento } from '@/painel/eventos-api'
import type { EventoDTO } from '@/schemas/evento'

/**
 * A miniatura é a mesma imagem que o WhatsApp mostra no preview do link: já sai do servidor
 * com o estilo e as cores do evento, então a lista não repete a conta da capa.
 */
export default function CartaoDeEvento({ evento }: { evento: EventoDTO }) {
  return (
    <Link
      to={`/eventos/${evento.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <img
        src={`/eventos/${evento.slug}/card.png`}
        alt=""
        loading="lazy"
        className="aspect-[1200/630] w-full object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        {evento.category && (
          <p
            className="font-heading text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: evento.accentColor }}
          >
            {evento.category}
          </p>
        )}
        <h3 className="mt-1 font-heading text-lg font-bold leading-tight text-iasd-dark group-hover:text-iasd-accent">
          {evento.title}
        </h3>
        <p className="mt-2 text-sm text-gray-600">{dataLongaDoEvento(evento.startsAt)}</p>
        {evento.locationName && <p className="text-sm text-gray-500">{evento.locationName}</p>}
      </div>
    </Link>
  )
}
