import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from '@/components/SectionTitle'
import { dataLongaDoEvento } from '@/painel/eventos-api'
import type { EventoDTO } from '@/schemas/evento'

/**
 * Os próximos eventos, do mais perto ao mais distante — a lista já vem assim do endpoint
 * público, que devolve só o que está publicado e ainda vai acontecer.
 */
export default function Eventos() {
  const [eventos, setEventos] = useState<EventoDTO[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/eventos')
      .then(res => (res.ok ? res.json() : null))
      .then(body => setEventos(body?.eventos ?? []))
      .catch(() => setEventos([]))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <main className="bg-white pb-20 pt-8">
      <div className="container mx-auto max-w-5xl px-4">
        <SectionTitle title="Eventos" subtitle="O que vem por aí na nossa igreja" />

        {carregando ? (
          <p className="text-center text-gray-500">Carregando eventos...</p>
        ) : eventos.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map(evento => (
              <CartaoDeEvento key={evento.id} evento={evento} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-iasd-light p-8 text-center">
            <p className="font-heading text-lg font-bold text-iasd-dark">
              Nenhum evento marcado por enquanto
            </p>
            <p className="mt-2 text-gray-600">
              Assim que a igreja marcar a próxima programação especial, ela aparece aqui — com a
              data, o local e o convite para salvar no calendário.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/sermoes"
                className="rounded-full border-2 border-iasd-dark px-6 py-2 font-heading font-bold text-iasd-dark transition-colors hover:bg-iasd-dark hover:text-white"
              >
                Ver os sermões
              </Link>
              <Link
                to="/"
                className="rounded-full bg-iasd-dark px-6 py-2 font-heading font-bold text-white transition-colors hover:bg-iasd-accent"
              >
                Voltar ao início
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/**
 * A miniatura é a mesma imagem que o WhatsApp mostra no preview do link: já sai do servidor
 * com o estilo e as cores do evento, então a lista não repete a conta da capa.
 */
function CartaoDeEvento({ evento }: { evento: EventoDTO }) {
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
        <h2 className="mt-1 font-heading text-lg font-bold leading-tight text-iasd-dark group-hover:text-iasd-accent">
          {evento.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{dataLongaDoEvento(evento.startsAt)}</p>
        {evento.locationName && <p className="text-sm text-gray-500">{evento.locationName}</p>}
      </div>
    </Link>
  )
}
