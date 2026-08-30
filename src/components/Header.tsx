import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

// Oculta o menu "Departamentos" enquanto só um departamento tem página: uma
// vitrine com um nome só passa a ideia de que a igreja escolheu um deles. A
// página segue no ar por link direto. Voltar a exibir é trocar para `true`.
const MOSTRAR_DEPARTAMENTOS = false

// Clubes e ministérios com página própria. Cada novo departamento entra aqui e
// aparece no menu sozinho, sem mexer no resto do header.
const departamentos = [
  { href: '/desbravadores', label: 'Clube de Desbravadores' },
]

const baseLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#ao-vivo', label: 'Ao Vivo' },
  // { href: '/#estudos', label: 'Estudos Bíblicos' },
  { href: '/sermoes', label: 'Sermões' },
  { href: '/galeria', label: 'Galeria' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  // Slug do último boletim publicado (por data de publicação); null = nenhum publicado.
  const [boletimSlug, setBoletimSlug] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const deptRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    fetch('/api/boletins')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBoletimSlug(data?.boletim?.slug ?? null))
      .catch(() => setBoletimSlug(null))
  }, [])

  // Trocar de página fecha o que estiver aberto.
  useEffect(() => {
    setMenuOpen(false)
    setDeptOpen(false)
  }, [location.pathname])

  // Clique fora e Esc fecham o submenu de departamentos.
  useEffect(() => {
    if (!deptOpen) return
    function onPointerDown(e: MouseEvent) {
      if (!deptRef.current?.contains(e.target as Node)) setDeptOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeptOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [deptOpen])

  // O item "Boletim" só aparece quando há ao menos um boletim publicado.
  const navLinks = boletimSlug
    ? [...baseLinks, { href: `/boletins/${boletimSlug}`, label: 'Boletim' }]
    : baseLinks

  // Páginas de departamento trocam a paleta do header (ver docs/patterns/pagina-departamento.md).
  const isAntares = location.pathname.startsWith('/desbravadores')
  const headerBg = isAntares
    ? `border-antares-gold/20 ${menuOpen ? 'bg-antares-ink' : 'bg-antares-ink/80'}`
    : `border-white/10 ${menuOpen ? 'bg-iasd-dark' : 'bg-iasd-dark/70'}`
  const painelBg = isAntares ? 'bg-antares-ink' : 'bg-iasd-dark'
  const emDepartamento = departamentos.some((d) => location.pathname.startsWith(d.href))

  function handleClick(href: string) {
    setMenuOpen(false)
    setDeptOpen(false)
    if (!href.startsWith('/#')) return
    const id = href.slice(2)
    if (location.pathname === '/') {
      // Já na home: rola direto até a seção.
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      // Em subpágina: navega para a home com o hash; o Home rola até a seção.
      navigate('/#' + id)
    }
  }

  const linkDesktop = 'text-sm font-medium text-white transition-colors hover:text-gray-300'

  return (
    <header
      className={`fixed top-0 z-50 w-full border-b backdrop-blur-lg transition-colors duration-300 ${headerBg}`}
    >
      <nav className="container mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/img/logo-iasd.png" alt="IASD Tucuruvi" width={40} height={40} className="rounded-lg" />
          <span className="font-heading text-lg font-bold text-white">IASD Tucuruvi</span>
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          <li>
            <a
              href="/#sobre"
              onClick={(e) => {
                e.preventDefault()
                handleClick('/#sobre')
              }}
              className={linkDesktop}
            >
              Sobre
            </a>
          </li>

          {MOSTRAR_DEPARTAMENTOS && (
            <li ref={deptRef} className="relative">
              <button
                type="button"
                onClick={() => setDeptOpen(!deptOpen)}
                aria-expanded={deptOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 ${linkDesktop} ${emDepartamento ? 'text-gray-300' : ''}`}
              >
                Departamentos
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${deptOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {deptOpen && (
                <ul
                  className={`absolute right-0 top-full mt-3 min-w-[15rem] overflow-hidden rounded-xl border border-white/10 py-1 shadow-xl ${painelBg}`}
                >
                  {departamentos.map((d) => (
                    <li key={d.href}>
                      {/* Fecha no clique: entrar no departamento em que já se está
                          não muda a rota, e o submenu ficaria aberto por cima. */}
                      <Link
                        to={d.href}
                        onClick={() => setDeptOpen(false)}
                        className="block px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        {d.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}

          {navLinks
            .filter((link) => link.href !== '/#sobre')
            .map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/#') ? (
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      handleClick(link.href)
                    }}
                    className={linkDesktop}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link to={link.href} className={linkDesktop}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
        </ul>

        <button
          className="text-white md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      <div
        className={`overflow-hidden shadow-lg transition-all duration-300 ease-out md:hidden ${painelBg} ${
          menuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!menuOpen}
      >
        <ul className="container mx-auto max-w-5xl divide-y divide-white/10 px-4 py-2">
          <li>
            <a
              href="/#sobre"
              tabIndex={menuOpen ? 0 : -1}
              onClick={(e) => {
                e.preventDefault()
                handleClick('/#sobre')
              }}
              className="block py-3 text-base font-medium text-white hover:text-gray-300"
            >
              Sobre
            </a>
          </li>

          {/* No mobile o submenu abre no lugar, empurrando os itens de baixo. */}
          {MOSTRAR_DEPARTAMENTOS && (
            <li>
              <button
                type="button"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setDeptOpen(!deptOpen)}
                aria-expanded={deptOpen}
                className="flex w-full items-center justify-between py-3 text-base font-medium text-white hover:text-gray-300"
              >
                Departamentos
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${deptOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {deptOpen && (
                <ul className="pb-2 pl-4">
                  {departamentos.map((d) => (
                    <li key={d.href}>
                      <Link
                        to={d.href}
                        tabIndex={menuOpen ? 0 : -1}
                        className="block py-2.5 text-sm font-medium text-gray-300 hover:text-white"
                        onClick={() => {
                          setMenuOpen(false)
                          setDeptOpen(false)
                        }}
                      >
                        {d.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}

          {navLinks
            .filter((link) => link.href !== '/#sobre')
            .map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/#') ? (
                  <a
                    href={link.href}
                    tabIndex={menuOpen ? 0 : -1}
                    onClick={(e) => {
                      e.preventDefault()
                      handleClick(link.href)
                    }}
                    className="block py-3 text-base font-medium text-white hover:text-gray-300"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    to={link.href}
                    tabIndex={menuOpen ? 0 : -1}
                    className="block py-3 text-base font-medium text-white hover:text-gray-300"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
        </ul>
      </div>
    </header>
  )
}
