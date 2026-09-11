import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import SectionTitle from '@/components/SectionTitle'
import DiagonalDivider from '@/components/DiagonalDivider'

/**
 * Validação do lado do visitante, só para mostrar o erro junto do campo. A que decide é a do
 * servidor, derivada da definição do formulário em server/modules/forms/catalog/.
 */
const asaSchema = z.object({
  nome: z.string().min(2, 'Escreva seu nome completo').max(120),
  telefone: z
    .string()
    .min(10, 'Informe DDD e número')
    .max(20)
    .regex(/^[\d\s()+-]+$/, 'Telefone inválido'),
  email: z.union([z.literal(''), z.string().email('E-mail inválido').max(200)]),
  bairro: z.string().min(2, 'Informe o bairro onde você mora').max(120),
  endereco: z.string().max(200),
  horario: z.string().min(1, 'Escolha o melhor horário para o contato'),
  pessoas: z.string().min(1, 'Informe quantas pessoas moram com você'),
  perfil: z.array(z.string()),
  ajuda: z.array(z.string()).min(1, 'Marque ao menos um tipo de ajuda'),
  situacao: z.string().min(10, 'Conte um pouco mais para a equipe entender a situação').max(1000),
  urgencia: z.string().min(1, 'Escolha a urgência do pedido'),
  consentimento: z
    .boolean()
    .refine((v) => v, 'Precisamos da sua autorização para entrar em contato'),
  honeypot: z.string().max(0),
})
type AsaFormData = z.infer<typeof asaSchema>

const TELEFONE = '(11) 2981-6615'
const TELEFONE_LINK = 'tel:+551129816615'
const WAZE_URL = 'https://waze.com/ul?ll=-23.4818054,-46.6006566&navigate=yes'
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=-23.4818054,-46.6006566'

const compromissos = [
  ['Dignidade em primeiro lugar.', 'O atendimento é reservado. Ninguém é exposto, fotografado ou identificado publicamente.'],
  ['Sem contrapartida.', 'Não pedimos participação em cultos, filiação nem contribuição de qualquer tipo.'],
  ['Escutar antes de entregar.', 'Cada família tem uma necessidade diferente; a conversa vem antes da cesta.'],
  ['Sigilo.', 'O que você contar fica com a equipe da ASA.'],
]

const frentes = [
  {
    icone: 'M16 11V7a4 4 0 10-8 0v4M5 9h14l1 12H4L5 9z',
    titulo: 'Alimento',
    texto: 'Cestas básicas e apoio alimentar às famílias acompanhadas pela equipe, com renovação enquanto a necessidade durar.',
  },
  {
    icone: 'M9 4l-5 3 2 4 3-1v10h6V10l3 1 2-4-5-3a3 3 0 01-6 0z',
    titulo: 'Roupas e agasalhos',
    texto: 'Doações recebidas, separadas por tamanho e entregues em bom estado — inclusive calçados, cobertores e enxoval de bebê.',
  },
  {
    icone: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zM20 21H4a1 1 0 01-1-1v-6h18v6a1 1 0 01-1 1zM3 14h18v-3a1 1 0 00-1-1H4a1 1 0 00-1 1v3z',
    titulo: 'Campanhas de época',
    texto: 'Mobilizações de inverno e de fim de ano, quando a igreja se organiza para alcançar mais famílias em pouco tempo.',
  },
  {
    icone: 'M3 12h4l2-5 4 10 2-5h6',
    titulo: 'Saúde e prevenção',
    texto: 'Feiras de saúde abertas ao bairro, com aferição de pressão, glicemia e orientação sobre hábitos e prevenção.',
  },
  {
    icone: 'M12 14l9-5-9-5-9 5 9 5zM6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5',
    titulo: 'Capacitação',
    texto: 'Cursos e oficinas gratuitos voltados à geração de renda, para que a ajuda de hoje vire autonomia amanhã.',
  },
  {
    icone: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    titulo: 'Emergências',
    texto: 'Resposta rápida a famílias atingidas por enchente, incêndio ou perda súbita de moradia, em articulação com a rede adventista de apoio.',
  },
]

const passos = [
  ['Você conta o que precisa', 'Pelo formulário desta página, por telefone ou pessoalmente na secretaria da igreja.'],
  ['A equipe entra em contato', 'Ligamos ou mandamos mensagem para o telefone que você informar, no horário que você indicar como melhor.'],
  ['Conversa reservada', 'Uma conversa — às vezes uma visita — para entender a situação e o que ajuda de verdade naquele momento.'],
  ['Atendimento e acompanhamento', 'A ajuda é combinada e entregue, e o contato continua enquanto fizer diferença para a família.'],
]

const formasDeAjudar = [
  {
    icone: 'M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM9 5h6v2H9V5z',
    titulo: 'Doe alimentos e roupas',
    texto: 'Alimentos não perecíveis dentro da validade, roupas e calçados em bom estado, cobertores e itens de higiene. Entregue na secretaria da igreja, nos horários de culto.',
  },
  {
    icone: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    titulo: 'Seja voluntário',
    texto: 'A ASA precisa de gente para separar doações, montar cestas, visitar famílias e dirigir. Qualquer disponibilidade ajuda, mesmo que seja um sábado por mês.',
  },
  {
    icone: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    titulo: 'Interceda',
    texto: 'Cada família atendida entra na lista de oração da equipe. Você pode se juntar a ela e acompanhar os pedidos da semana.',
  },
]

const horarios = ['Manhã', 'Tarde', 'Noite', 'Qualquer horário']
const tamanhosDeCasa = ['Moro sozinho(a)', '2 pessoas', '3 pessoas', '4 pessoas', '5 pessoas', '6 ou mais']
const perfisDaCasa = ['Crianças', 'Pessoas idosas', 'Gestante ou bebê', 'Pessoa doente ou com deficiência']
const tiposDeAjuda = [
  'Alimentos',
  'Roupas e agasalhos',
  'Itens de higiene e limpeza',
  'Apoio espiritual e oração',
  'Orientação e encaminhamento',
  'Outro',
]
const urgencias = [
  'Preciso de ajuda ainda esta semana',
  'Preciso de ajuda neste mês',
  'Não é urgente, mas preciso de apoio contínuo',
]
const cultos = [
  ['Sábado — Culto Divino:', '9h30'],
  ['Sábado — Escola Sabatina:', '11h10'],
  ['Domingo — Culto:', '19h00'],
  ['Quarta-feira — Culto:', '20h00'],
]

const campoClasses =
  'mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 focus:border-asa-gold focus:outline-none focus:ring-1 focus:ring-asa-gold'
const caixaClasses =
  'flex items-center gap-3 rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 transition-colors hover:border-asa-gold'

function Icone({ d, className = 'h-6 w-6' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return <p className="mt-1 text-sm text-red-600">{mensagem}</p>
}

export default function ASA() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AsaFormData>({
    resolver: zodResolver(asaSchema),
    defaultValues: {
      email: '',
      endereco: '',
      perfil: [],
      ajuda: [],
      consentimento: false,
      honeypot: '',
    },
  })

  const situacao = watch('situacao') ?? ''

  async function onSubmit(data: AsaFormData) {
    setStatus('sending')
    try {
      // O motor de formulários guarda cada campo como texto; os grupos de caixas viram uma
      // string com os itens separados por vírgula.
      const res = await fetch('/api/formularios/asa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          perfil: data.perfil.join(', '),
          ajuda: data.ajuda.join(', '),
          consentimento: data.consentimento ? 'Sim' : '',
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main>
      <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-asa-ink pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-asa-ink/30 via-asa-ink/70 to-asa-ink" />
        <div className="animate-down-slice relative z-10 px-4 py-20 text-center">
          <img
            src="/img/asa-simbolo-claro.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-8 h-32 w-32 md:h-40 md:w-40"
          />
          <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-asa-gold">
            Igreja Adventista do Sétimo Dia — Tucuruvi
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold text-white md:text-6xl">
            Ação Solidária
            <br className="hidden sm:block" /> Adventista
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-gray-300">
            Ninguém precisa atravessar uma dificuldade sozinho. Se a sua família está passando por
            necessidade, conte pra gente — o atendimento é gratuito e reservado.
          </p>
          <div className="relative mt-6 inline-block">
            <p className="italic text-asa-gold">
              &ldquo;Cada um cuide não somente dos seus interesses, mas também dos interesses dos
              outros.&rdquo; — Filipenses 2:4
            </p>
            <div className="absolute inset-0 bg-asa-ink animate-reveal-width" />
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#preciso-de-ajuda"
              className="inline-flex w-full items-center justify-center rounded-full bg-asa-gold px-8 py-4 font-heading font-bold text-asa-ink shadow-lg shadow-black/20 transition-transform hover:scale-105 sm:w-auto"
            >
              Preciso de ajuda
            </a>
            <a
              href="#quero-ajudar"
              className="inline-flex w-full items-center justify-center rounded-full border-2 border-white/70 px-8 py-4 font-heading font-bold text-white transition-colors hover:bg-white hover:text-asa-ink sm:w-auto"
            >
              Quero ajudar
            </a>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-ink" toColor="bg-asa-cream" />

      <section className="bg-asa-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="O que é a ASA"
            subtitle="O trabalho social da nossa igreja"
            variant="asa"
            revealBg="bg-asa-cream"
          />
          <div className="grid gap-12 md:grid-cols-2">
            <div data-aos="zoom-in">
              <p className="leading-relaxed text-stone-700">
                A ASA — Ação Solidária Adventista — é a frente de assistência social da Igreja
                Adventista do Sétimo Dia. Reúne voluntários da própria comunidade para atender
                famílias em situação de vulnerabilidade com alimento, roupa, orientação e presença.
              </p>
              <p className="mt-4 leading-relaxed text-stone-700">
                É o mesmo trabalho que as Sociedades Dorcas iniciaram na igreja adventista há mais
                de um século: gente que se organiza para socorrer o vizinho. Aqui no Tucuruvi, a ASA
                atende quem procura a igreja e também as famílias que a equipe identifica no bairro.
              </p>
              <p className="mt-4 leading-relaxed text-stone-700">
                O atendimento é <strong>gratuito</strong> e não depende de credo, origem ou de
                qualquer vínculo com a igreja. Você não precisa frequentar nossos cultos para ser
                atendido.
              </p>
            </div>

            <div data-aos="zoom-in" data-aos-delay="150">
              <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-asa-sand p-6 shadow-sm">
                <img
                  src="/img/asa-simbolo.svg"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 opacity-[0.06]"
                />
                <h3 className="font-heading text-xl font-bold text-asa-ink">Nossos compromissos</h3>
                <ul className="mt-4 space-y-4 text-stone-700">
                  {compromissos.map(([titulo, texto]) => (
                    <li key={titulo} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-asa-gold" />
                      <div>
                        <strong>{titulo}</strong> {texto}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-cream" toColor="bg-asa-sand" direction="top" />

      <section className="bg-asa-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Como atuamos"
            subtitle="As frentes de trabalho da ASA"
            variant="asa"
            revealBg="bg-asa-sand"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {frentes.map((frente, i) => (
              <div
                key={frente.titulo}
                data-aos="fade-up"
                data-aos-delay={(i % 3) * 80}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-asa-ink/5 text-asa-gold-deep">
                  <Icone d={frente.icone} />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-asa-ink">{frente.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{frente.texto}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 max-w-2xl text-center" data-aos="fade-up">
            <p className="text-sm text-stone-600">
              Precisa de algo que não está nesta lista? Escreva mesmo assim no formulário — a equipe
              avalia caso a caso e, quando não puder atender, indica onde procurar.
            </p>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-sand" toColor="bg-asa-cream" />

      <section className="bg-asa-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Como funciona o atendimento"
            subtitle="Do pedido até a ajuda chegar"
            variant="asa"
            revealBg="bg-asa-cream"
          />
          <ol className="grid gap-8 md:grid-cols-4">
            {passos.map(([titulo, texto], i) => (
              <li key={titulo} data-aos="fade-up" data-aos-delay={i * 80}>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full font-heading text-lg font-bold ${
                    i === passos.length - 1 ? 'bg-asa-gold text-asa-ink' : 'bg-asa-ink text-white'
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-asa-ink">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{texto}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-2xl border border-asa-gold/30 bg-asa-gold/10 p-6" data-aos="fade-up">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-asa-gold/15 text-asa-gold-deep">
                <Icone
                  className="h-5 w-5"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </span>
              <div>
                <h3 className="font-heading font-bold text-asa-ink">
                  Seus dados ficam com a equipe da ASA
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">
                  As informações do formulário são usadas apenas para o atendimento e ficam
                  restritas aos voluntários responsáveis. Não são divulgadas, não vão para redes
                  sociais e não são compartilhadas com terceiros. Você pode pedir a exclusão dos seus
                  dados a qualquer momento pelo telefone da igreja.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-cream" toColor="bg-asa-sand" direction="top" />

      <section id="preciso-de-ajuda" className="scroll-mt-20 bg-asa-sand py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Preciso de ajuda"
            subtitle="Preencha e a equipe da ASA entrará em contato"
            variant="asa"
            revealBg="bg-asa-sand"
          />

          <div className="mx-auto max-w-2xl" data-aos="zoom-in">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
              {status === 'success' ? (
                <div className="rounded-lg bg-green-50 p-8 text-center text-green-800">
                  <p className="font-heading text-lg font-bold">Seu pedido foi enviado.</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    A equipe da ASA vai entrar em contato pelo telefone que você informou, no horário
                    que você indicou. Se precisar falar antes, ligue para {TELEFONE}.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-stone-700">
                    Preencha com calma. Só os campos marcados com{' '}
                    <span className="text-red-600">*</span> são obrigatórios — o resto ajuda a equipe
                    a entender melhor, mas pode ficar em branco.
                  </p>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
                    <input type="text" {...register('honeypot')} className="hidden" tabIndex={-1} autoComplete="off" />

                    <fieldset className="space-y-4">
                      <legend className="font-heading text-sm font-bold uppercase tracking-wider text-asa-ink">
                        Seus dados
                      </legend>

                      <div>
                        <label htmlFor="nome" className="block text-sm font-medium text-stone-700">
                          Nome completo <span className="text-red-600">*</span>
                        </label>
                        <input id="nome" type="text" autoComplete="name" {...register('nome')} className={campoClasses} />
                        <Erro mensagem={errors.nome?.message} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="telefone" className="block text-sm font-medium text-stone-700">
                            Telefone / WhatsApp <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="telefone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="(11) 90000-0000"
                            {...register('telefone')}
                            className={campoClasses}
                          />
                          <Erro mensagem={errors.telefone?.message} />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                            E-mail <span className="text-stone-400">(opcional)</span>
                          </label>
                          <input id="email" type="email" autoComplete="email" {...register('email')} className={campoClasses} />
                          <Erro mensagem={errors.email?.message} />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="bairro" className="block text-sm font-medium text-stone-700">
                            Bairro onde mora <span className="text-red-600">*</span>
                          </label>
                          <input id="bairro" type="text" {...register('bairro')} className={campoClasses} />
                          <Erro mensagem={errors.bairro?.message} />
                        </div>
                        <div>
                          <label htmlFor="horario" className="block text-sm font-medium text-stone-700">
                            Melhor horário para contato <span className="text-red-600">*</span>
                          </label>
                          <select id="horario" {...register('horario')} className={`${campoClasses} bg-white`}>
                            <option value="">Selecione...</option>
                            {horarios.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                          <Erro mensagem={errors.horario?.message} />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="endereco" className="block text-sm font-medium text-stone-700">
                          Endereço <span className="text-stone-400">(opcional)</span>
                        </label>
                        <input
                          id="endereco"
                          type="text"
                          autoComplete="street-address"
                          placeholder="Rua, número e complemento"
                          {...register('endereco')}
                          className={campoClasses}
                        />
                        <p className="mt-1 text-xs text-stone-500">
                          Se preferir, deixe em branco e informe depois, na conversa com a equipe.
                        </p>
                      </div>
                    </fieldset>

                    <hr className="border-stone-200" />

                    <fieldset className="space-y-4">
                      <legend className="font-heading text-sm font-bold uppercase tracking-wider text-asa-ink">
                        Sua casa
                      </legend>

                      <div className="sm:w-1/2">
                        <label htmlFor="pessoas" className="block text-sm font-medium text-stone-700">
                          Quantas pessoas moram com você <span className="text-red-600">*</span>
                        </label>
                        <select id="pessoas" {...register('pessoas')} className={`${campoClasses} bg-white`}>
                          <option value="">Selecione...</option>
                          {tamanhosDeCasa.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                        <Erro mensagem={errors.pessoas?.message} />
                      </div>

                      <div>
                        <span className="block text-sm font-medium text-stone-700">
                          Há na casa <span className="text-stone-400">(marque o que se aplica)</span>
                        </span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {perfisDaCasa.map((p) => (
                            <label key={p} className={caixaClasses}>
                              <input
                                type="checkbox"
                                value={p}
                                {...register('perfil')}
                                className="h-4 w-4 rounded border-stone-300 text-asa-gold-deep focus:ring-asa-gold"
                              />
                              {p}
                            </label>
                          ))}
                        </div>
                      </div>
                    </fieldset>

                    <hr className="border-stone-200" />

                    <fieldset className="space-y-4">
                      <legend className="font-heading text-sm font-bold uppercase tracking-wider text-asa-ink">
                        O que você precisa
                      </legend>

                      <div>
                        <span className="block text-sm font-medium text-stone-700">
                          Tipo de ajuda <span className="text-red-600">*</span>{' '}
                          <span className="text-stone-400">(pode marcar mais de uma)</span>
                        </span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {tiposDeAjuda.map((t) => (
                            <label key={t} className={caixaClasses}>
                              <input
                                type="checkbox"
                                value={t}
                                {...register('ajuda')}
                                className="h-4 w-4 rounded border-stone-300 text-asa-gold-deep focus:ring-asa-gold"
                              />
                              {t}
                            </label>
                          ))}
                        </div>
                        <Erro mensagem={errors.ajuda?.message} />
                      </div>

                      <div>
                        <label htmlFor="situacao" className="block text-sm font-medium text-stone-700">
                          Conte um pouco da sua situação <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          id="situacao"
                          rows={5}
                          maxLength={1000}
                          placeholder="Escreva com suas palavras o que está acontecendo e desde quando. Não precisa de formalidade."
                          {...register('situacao')}
                          className={campoClasses}
                        />
                        <div className="mt-1 flex items-start justify-between gap-4">
                          <Erro mensagem={errors.situacao?.message} />
                          <p className="ml-auto text-xs text-stone-500">{situacao.length}/1000</p>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="urgencia" className="block text-sm font-medium text-stone-700">
                          Qual a urgência <span className="text-red-600">*</span>
                        </label>
                        <select id="urgencia" {...register('urgencia')} className={`${campoClasses} bg-white`}>
                          <option value="">Selecione...</option>
                          {urgencias.map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                        <Erro mensagem={errors.urgencia?.message} />
                      </div>
                    </fieldset>

                    <hr className="border-stone-200" />

                    <div>
                      <label className="flex items-start gap-3 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          {...register('consentimento')}
                          className="mt-1 h-4 w-4 flex-shrink-0 rounded border-stone-300 text-asa-gold-deep focus:ring-asa-gold"
                        />
                        <span>
                          Autorizo a equipe da ASA da IASD Tucuruvi a usar estas informações para
                          entrar em contato comigo e organizar o atendimento.{' '}
                          <span className="text-red-600">*</span>
                        </span>
                      </label>
                      <Erro mensagem={errors.consentimento?.message} />
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'sending'}
                      className="w-full rounded-lg bg-asa-gold py-3 font-heading font-bold text-asa-ink transition-transform hover:scale-[1.02] disabled:opacity-50"
                    >
                      {status === 'sending' ? 'Enviando...' : 'Enviar pedido de ajuda'}
                    </button>

                    {status === 'error' && (
                      <p className="text-center text-sm text-red-600">
                        Não conseguimos enviar seu pedido. Tente de novo ou ligue para {TELEFONE}.
                      </p>
                    )}

                    <p className="text-center text-xs text-stone-500">
                      Se preferir falar por telefone, ligue para {TELEFONE} e peça para falar com a
                      ASA.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-sand" toColor="bg-asa-ink" direction="top" />

      <section id="quero-ajudar" className="scroll-mt-20 bg-asa-ink py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle title="Quero ajudar" subtitle="Três formas de entrar nessa" light variant="asa" />
          <div className="grid gap-6 md:grid-cols-3">
            {formasDeAjudar.map((forma, i) => (
              <div
                key={forma.titulo}
                data-aos="fade-up"
                data-aos-delay={i * 80}
                className="rounded-2xl border border-asa-gold/20 bg-white/5 p-6 backdrop-blur-sm"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-asa-gold">
                  <Icone d={forma.icone} />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-white">{forma.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">{forma.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center" data-aos="fade-up">
            <a
              href={TELEFONE_LINK}
              className="inline-flex items-center gap-2 rounded-full border-2 border-white px-8 py-3 font-heading font-bold text-white transition-colors hover:bg-white hover:text-asa-ink"
            >
              <Icone
                className="h-5 w-5"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
              Falar com a ASA — {TELEFONE}
            </a>
          </div>
        </div>
      </section>

      <DiagonalDivider fromColor="bg-asa-ink" toColor="bg-asa-cream" />

      <section className="bg-asa-cream py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <SectionTitle
            title="Onde nos encontrar"
            subtitle="A ASA funciona na sede da igreja"
            variant="asa"
            revealBg="bg-asa-cream"
          />
          <div className="grid gap-12 md:grid-cols-2">
            <div data-aos="zoom-in">
              <h3 className="font-heading text-xl font-bold text-asa-ink">IASD Tucuruvi</h3>
              <p className="mt-3 leading-relaxed text-stone-700">
                R. Cruz de Malta, 1201 — Parada Inglesa
                <br />
                São Paulo - SP, 02248-001
              </p>
              <p className="mt-3">
                <a href={TELEFONE_LINK} className="font-medium text-asa-gold-deep hover:underline">
                  {TELEFONE}
                </a>
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={WAZE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#33CCFF] px-6 py-2 font-heading text-sm font-bold text-white transition-transform hover:scale-105"
                >
                  <img src="/img/waze.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                  Como chegar pelo Waze
                </a>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border-2 border-asa-ink px-6 py-2 font-heading text-sm font-bold text-asa-ink transition-colors hover:bg-asa-ink hover:text-white"
                >
                  Abrir no Google Maps
                </a>
              </div>
            </div>

            <div data-aos="zoom-in" data-aos-delay="150">
              <h3 className="font-heading text-xl font-bold text-asa-ink">Horários de culto</h3>
              <p className="mt-2 text-sm text-stone-600">
                Nestes horários há sempre alguém na secretaria para receber doações ou anotar um
                pedido.
              </p>
              <ul className="mt-4 space-y-3 text-stone-700">
                {cultos.map(([dia, hora]) => (
                  <li key={dia} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-asa-gold" />
                    <div>
                      <strong>{dia}</strong> {hora}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div data-aos="zoom-in" className="mt-12">
            <iframe
              title="Localização IASD Tucuruvi"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.5!2d-46.6006566!3d-23.4818054!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cef60d01575eaf%3A0x65eca2ad07d28b31!2sIgreja%20Adventista%20do%20S%C3%A9timo%20Dia%20-%20Tucuruvi!5e0!3m2!1spt-BR!2sbr"
              className="h-64 w-full rounded-lg shadow-lg"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
