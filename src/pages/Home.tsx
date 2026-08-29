import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Hero from '@/components/Hero'
import DiagonalDivider from '@/components/DiagonalDivider'
import Sobre from '@/components/Sobre'
import AoVivo from '@/components/AoVivo'
import EstudosBiblicos from '@/components/EstudosBiblicos'
import SermoesPreview from '@/components/SermoesPreview'
import GaleriaPreview from '@/components/GaleriaPreview'

export default function Home() {
  const location = useLocation()

  // Ao chegar na home com um hash (ex.: vindo de uma subpágina via menu), rola até a seção.
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }, 60)
    return () => clearTimeout(t)
  }, [location.hash, location.key])

  return (
    <main>
      <Hero />
      <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-white" />
      <Sobre />
      <DiagonalDivider fromColor="bg-white" toColor="bg-iasd-dark" direction="top" />
      <AoVivo />
      <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-iasd-light" />
      {/* <EstudosBiblicos /> */}
      <SermoesPreview />
      <GaleriaPreview />
    </main>
  )
}
