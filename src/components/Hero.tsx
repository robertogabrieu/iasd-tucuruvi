import Countdown from './Countdown'

export default function Hero() {
  return (
    // Altura da tela visível (svh), não 100vh: no celular a barra do navegador come o fim da
    // seção, e a seta ficava fora do alcance da vista.
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-iasd-dark pt-16">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('/img/hero-bg.jpg')" }}
      />
      <div className="animate-down-slice relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6">
          <img src="/img/logo-iasd.png" alt="IASD" className="mx-auto h-24 w-24 rounded-2xl" />
        </div>
        <h1 className="font-heading text-5xl font-bold text-white md:text-7xl">
          Adventistas Tucuruvi
        </h1>
        <p className="mt-4 text-lg text-gray-300 md:text-xl">
          Igreja Adventista do Sétimo Dia
        </p>
        <div className="relative mt-6 inline-block">
          <p className="text-blue-300 italic">
            &ldquo;Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.&rdquo;
            — Mateus 11:28
          </p>
          <div className="absolute inset-0 bg-iasd-dark animate-reveal-width" />
        </div>
        <div className="mt-10">
          <Countdown />
        </div>
        <div className="mt-8">
          <a
            href="#ao-vivo"
            className="inline-block rounded-full bg-iasd-accent px-8 py-3 font-heading font-bold text-white transition-transform hover:scale-105"
          >
            Assista ao Vivo
          </a>
        </div>
      </div>
      {/* A seta fica no fluxo, embaixo do conteúdo: em tela baixa ela antes subia por cima do
          botão. E o pulo mora no próprio ícone — a centralização e a animação disputam o mesmo
          recurso de posicionamento, e a seta acabava fora do meio da tela. */}
      <div className="relative z-10 flex justify-center pb-8 pt-10">
        <svg className="h-6 w-6 animate-bounce text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7" />
        </svg>
      </div>
    </section>
  )
}
