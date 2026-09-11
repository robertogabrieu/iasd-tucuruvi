import { useMemo, type ReactNode } from 'react'
import { generateHTML } from '@tiptap/html'
import { boletimTextExtensions as extensions } from '@/components/boletim/tiptap-extensions'
import EventoHero from '@/components/evento/EventoHero'
import { montarIcs } from '@/components/evento/evento-ics'
import { dataLongaDoEvento, mensagemDeCompartilhamento } from '@/painel/eventos-api'
import type { EventoDTO } from '@/schemas/evento'

const ICONE_WHATSAPP = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
)

/**
 * A página do evento inteira, compartilhada entre a rota pública e a pré-visualização do
 * painel — o que o líder vê antes de publicar é o mesmo componente que o visitante abre.
 *
 * `link` é o endereço que vai no convite de calendário e no WhatsApp; em rascunho ele ainda
 * não existe, e aí a mensagem sai só com o nome e a data.
 */
export default function EventoRenderer({ evento, link }: { evento: EventoDTO; link: string | null }) {
  const descricao = useMemo(() => {
    try {
      return generateHTML(evento.description as Parameters<typeof generateHTML>[0], extensions)
    } catch {
      return ''
    }
  }, [evento.description])

  const endereco = evento.locationAddress
  const temTexto = descricao.replace(/<[^>]*>/g, '').trim().length > 0

  // Sem descrição não há coluna larga ao lado: os cartões se espalham pela largura toda.
  const colunaLateral = temTexto
    ? 'space-y-6'
    : 'space-y-6 md:col-span-3 md:grid md:grid-cols-3 md:gap-6 md:space-y-0'

  function baixarConvite() {
    const arquivo = new Blob([montarIcs({ ...evento, publicUrl: link })], {
      type: 'text/calendar;charset=utf-8',
    })
    const url = URL.createObjectURL(arquivo)
    const ancora = document.createElement('a')
    ancora.href = url
    ancora.download = `${evento.slug ?? 'evento'}.ics`
    document.body.appendChild(ancora)
    ancora.click()
    ancora.remove()
    URL.revokeObjectURL(url)
  }

  const mensagem = mensagemDeCompartilhamento({
    title: evento.title,
    startsAt: evento.startsAt,
    publicUrl: link,
  })

  return (
    <main>
      <EventoHero evento={evento} />

      <div className="boletim-bg">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-3">
          {temTexto && (
            <Cartao titulo="Sobre o evento" className="md:col-span-2">
              <div
                className="boletim-prose mt-4 font-sans text-base leading-relaxed text-gray-700"
                dangerouslySetInnerHTML={{ __html: descricao }}
              />
            </Cartao>
          )}

          <div className={colunaLateral}>
            {evento.locationName && (
              <Cartao titulo="Como chegar">
                <p className="mt-3 text-sm leading-relaxed text-gray-700">
                  {evento.locationName}
                  {endereco && (
                    <>
                      <br />
                      {endereco}
                    </>
                  )}
                </p>
                {endereco && (
                  <>
                    <iframe
                      title={`Mapa até ${evento.locationName}`}
                      src={`https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="mt-4 h-40 w-full rounded-lg border border-gray-200"
                    />
                    <div className="mt-4 flex gap-2">
                      <LinkDeMapa
                        href={`https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`}
                        rotulo="Waze"
                      />
                      <LinkDeMapa
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
                        rotulo="Maps"
                      />
                    </div>
                  </>
                )}
              </Cartao>
            )}

            <Cartao titulo="Adicionar à agenda">
              <p className="mt-3 text-sm text-gray-600">
                Salve a data no calendário do celular: {dataLongaDoEvento(evento.startsAt)}.
              </p>
              <button
                type="button"
                onClick={baixarConvite}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-iasd-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-iasd-accent"
              >
                Baixar convite
              </button>
            </Cartao>

            <Cartao titulo="Compartilhar">
              <p className="mt-3 text-sm text-gray-600">Chame a igreja para o evento.</p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition-[filter] hover:brightness-95"
              >
                {ICONE_WHATSAPP}
                WhatsApp
              </a>
            </Cartao>
          </div>
        </div>
      </div>
    </main>
  )
}

function Cartao({
  titulo, className = '', children,
}: {
  titulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      <h2 className="font-heading font-bold text-iasd-dark">{titulo}</h2>
      {children}
    </section>
  )
}

function LinkDeMapa({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex flex-1 items-center justify-center rounded-lg border border-iasd-dark px-3 py-1.5 text-sm font-medium text-iasd-dark transition-colors hover:bg-gray-100"
    >
      {rotulo}
    </a>
  )
}
