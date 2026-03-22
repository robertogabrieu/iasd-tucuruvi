import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-iasd-dark text-white">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-lg font-bold">IASD Tucuruvi</h3>
          <p className="mt-2 text-sm text-gray-400">
            Igreja Adventista do Sétimo Dia — Tucuruvi
          </p>
          <p className="mt-1 text-sm text-gray-400">São Paulo, SP</p>
        </div>
        <div>
          <h4 className="font-heading font-bold">Links</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li><Link href="/#sobre" className="hover:text-white">Sobre</Link></li>
            <li><Link href="/#ao-vivo" className="hover:text-white">Ao Vivo</Link></li>
            <li><Link href="/#estudos" className="hover:text-white">Estudos Bíblicos</Link></li>
            <li><Link href="/sermoes" className="hover:text-white">Sermões</Link></li>
            <li><Link href="/galeria" className="hover:text-white">Galeria</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold">Redes Sociais</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            <li>
              <a href="https://www.youtube.com/@IASDTucuruviOficial" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                YouTube
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/iasdtucuruvi/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Instagram
              </a>
            </li>
            <li>
              <a href="https://www.flickr.com/photos/198977834@N03/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Flickr
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-700 px-4 py-4 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} IASD Tucuruvi. Todos os direitos reservados.
      </div>
    </footer>
  )
}
