import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Spinner } from '@/painel/ui'
import { uploadImagemDeEvento } from '@/painel/eventos-api'
import { recorteSuportado, removerFundo } from '@/painel/lib/remover-fundo'

const TAMANHO_MAXIMO = 5 * 1024 * 1024
const FORMATOS = ['image/jpeg', 'image/png', 'image/webp']

/** Xadrez cinza que revela a transparência da foto recortada, como no mockup. */
const XADREZ = {
  backgroundImage:
    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
}

type Etapa = 'vazio' | 'processando' | 'enviando' | 'pronto'
type EmUso = 'recortada' | 'original'

interface Props {
  /** Id da mídia já salva no evento, ou null. */
  mediaId: string | null
  onChange: (mediaId: string | null) => void
}

/**
 * Campo de foto do responsável: escolhe o arquivo, remove o fundo no próprio navegador e mostra
 * original e recortada lado a lado antes de salvar. O recorte é um ganho, nunca um pré-requisito
 * — se o navegador não suportar ou o modelo não carregar, a tela avisa e oferece a foto original.
 */
export default function FotoComRecorte({ mediaId, onChange }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(mediaId ? 'pronto' : 'vazio')
  const [progresso, setProgresso] = useState(0)
  const [original, setOriginal] = useState<File | null>(null)
  const [recortada, setRecortada] = useState<Blob | null>(null)
  const [emUso, setEmUso] = useState<EmUso>('recortada')
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const urlOriginal = useObjectUrl(original)
  const urlRecortada = useObjectUrl(recortada)

  // Enquanto não há arquivo escolhido nesta sessão, quem manda na etapa é a foto já salva no
  // evento — que chega depois, quando o formulário termina de carregar.
  useEffect(() => {
    if (!original) setEtapa(mediaId ? 'pronto' : 'vazio')
  }, [mediaId, original])

  function limpar() {
    setOriginal(null)
    setRecortada(null)
    setAviso(null)
    setErro(null)
    setProgresso(0)
    setEmUso('recortada')
  }

  async function enviar(imagem: Blob, nome: string) {
    setEtapa('enviando')
    try {
      const media = await uploadImagemDeEvento(imagem, nome)
      onChange(media.id)
      setEtapa('pronto')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a imagem.')
      setEtapa('pronto')
    }
  }

  async function escolher(file: File) {
    limpar()
    if (!FORMATOS.includes(file.type)) {
      setErro('Envie uma imagem JPEG, PNG ou WebP.')
      return
    }
    if (file.size > TAMANHO_MAXIMO) {
      setErro('Imagem muito grande. Tamanho máximo: 5 MB.')
      return
    }
    setOriginal(file)

    if (!recorteSuportado()) {
      setEtapa('pronto')
      setEmUso('original')
      setAviso('Este navegador não consegue remover o fundo. Dá para seguir com a foto original.')
      return
    }

    setEtapa('processando')
    try {
      const semFundo = await removerFundo(file, setProgresso)
      setRecortada(semFundo)
      await enviar(semFundo, trocarExtensao(file.name))
    } catch {
      setEtapa('pronto')
      setEmUso('original')
      setAviso('Não deu para remover o fundo agora. Dá para seguir com a foto original.')
    }
  }

  function usarOriginal() {
    if (!original) return
    setEmUso('original')
    setAviso(null)
    void enviar(original, original.name)
  }

  function usarRecortada() {
    if (!recortada || !original) return
    setEmUso('recortada')
    void enviar(recortada, trocarExtensao(original.name))
  }

  function trocar() {
    limpar()
    onChange(null)
    setEtapa('vazio')
    inputRef.current?.click()
  }

  const ocupado = etapa === 'processando' || etapa === 'enviando'

  return (
    <div className="rounded-lg border border-gray-200 bg-iasd-light p-4">
      <input
        ref={inputRef}
        type="file"
        accept={FORMATOS.join(',')}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void escolher(file)
        }}
      />

      {etapa === 'vazio' && !mediaId && (
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Escolher foto
          </Button>
          <p className="min-w-[220px] flex-1 text-sm text-gray-600">
            O fundo é removido no seu próprio navegador. A foto original não sai do seu computador.
          </p>
        </div>
      )}

      {etapa === 'processando' && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Spinner className="h-4 w-4" />
            Removendo o fundo aqui no seu computador…
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-iasd-accent transition-[width]"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            Na primeira vez o modelo precisa ser baixado; nas próximas ele já fica no navegador.
          </p>
        </div>
      )}

      {(etapa === 'enviando' || etapa === 'pronto') && (
        <div className="flex flex-wrap items-center gap-4">
          {urlOriginal && (
            <Miniatura
              url={urlOriginal}
              rotulo="Enviada"
              alt="Foto original, com o fundo"
              selecionada={emUso === 'original'}
            />
          )}
          {urlOriginal && urlRecortada && <Seta />}
          {urlRecortada && (
            <Miniatura
              url={urlRecortada}
              rotulo="Recortada"
              alt="Mesma foto com o fundo removido"
              selecionada={emUso === 'recortada'}
              transparente
            />
          )}
          {!urlOriginal && mediaId && (
            <Miniatura
              url={`/media/${mediaId}`}
              rotulo="Foto salva"
              alt="Foto do responsável salva no evento"
              selecionada
              transparente
            />
          )}

          <div className="min-w-[220px] flex-1 space-y-3">
            <p className="text-sm text-gray-600">
              {recortada
                ? 'Fundo removido no seu próprio navegador. A foto original não sai do seu computador.'
                : 'A foto vai para a capa do jeito que está.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={ocupado} onClick={trocar}>
                Trocar foto
              </Button>
              {recortada && emUso === 'original' && (
                <Button variant="ghost" size="sm" disabled={ocupado} onClick={usarRecortada}>
                  Usar a foto recortada
                </Button>
              )}
              {recortada && emUso === 'recortada' && (
                <Button variant="ghost" size="sm" disabled={ocupado} onClick={usarOriginal}>
                  Usar a foto original
                </Button>
              )}
              {original && !recortada && !mediaId && (
                <Button variant="primary" size="sm" disabled={ocupado} onClick={usarOriginal}>
                  Usar a foto original
                </Button>
              )}
            </div>
            {etapa === 'enviando' && (
              <p className="flex items-center gap-2 text-sm text-gray-600"><Spinner className="h-4 w-4" />Enviando…</p>
            )}
          </div>
        </div>
      )}

      {aviso && <div className="mt-3"><Alert kind="err">{aviso}</Alert></div>}
      {erro && <div className="mt-3"><Alert kind="err">{erro}</Alert></div>}
    </div>
  )
}

function Miniatura({ url, rotulo, alt, selecionada, transparente }: {
  url: string
  rotulo: string
  alt: string
  selecionada: boolean
  transparente?: boolean
}) {
  return (
    <figure className="shrink-0">
      <div
        className={`h-28 w-24 overflow-hidden rounded-lg border ${selecionada ? 'border-2 border-iasd-accent' : 'border-gray-300'}`}
        style={transparente ? XADREZ : undefined}
      >
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      </div>
      <figcaption className={`mt-1.5 text-center text-xs ${selecionada ? 'font-medium text-iasd-dark' : 'text-gray-500'}`}>
        {rotulo}
      </figcaption>
    </figure>
  )
}

function Seta() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** URL temporária do blob, revogada quando ele muda ou o componente sai da tela. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) { setUrl(null); return }
    const criada = URL.createObjectURL(blob)
    setUrl(criada)
    return () => URL.revokeObjectURL(criada)
  }, [blob])
  return url
}

function trocarExtensao(nome: string): string {
  return `${nome.replace(/\.[^.]+$/, '')}.webp`
}
