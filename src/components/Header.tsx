import { useState } from 'react'
import { Link } from 'react-router-dom'

const navLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#ao-vivo', label: 'Ao Vivo' },
  { href: '/#estudos', label: 'Estudos Bíblicos' },
  { href: '/sermoes', label: 'Sermões' },
  { href: '/galeria', label: 'Galeria' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  function handleClick(href: string) {
    setMenuOpen(false)
    // Handle hash links for same-page navigation
    if (href.startsWith('/#')) {
      const id = href.slice(2)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <header className="fixed top-0 z-50 w-full bg-iasd-dark/95 backdrop-blur-sm">
      <nav className="container mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/img/logo-iasd.png" alt="IASD Tucuruvi" width={40} height={40} className="rounded-lg" />
          <span className="font-heading text-lg font-bold text-white">IASD Tucuruvi</span>
        </Link>

        <ul className="hidden gap-6 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              {link.href.startsWith('/#') ? (
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    handleClick(link.href)
                  }}
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  to={link.href}
                  className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
                >
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

      {menuOpen && (
        <div className="bg-iasd-dark/95 px-4 pb-4 md:hidden">
          <ul className="space-y-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/#') ? (
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      handleClick(link.href)
                    }}
                    className="block text-gray-300 hover:text-white"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    to={link.href}
                    className="block text-gray-300 hover:text-white"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
