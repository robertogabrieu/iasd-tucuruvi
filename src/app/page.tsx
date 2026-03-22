import Header from '@/components/Header'
import Hero from '@/components/Hero'
import DiagonalDivider from '@/components/DiagonalDivider'
import Sobre from '@/components/Sobre'
import AoVivo from '@/components/AoVivo'
import EstudosBiblicos from '@/components/EstudosBiblicos'
import SermoesPreview from '@/components/SermoesPreview'
import GaleriaPreview from '@/components/GaleriaPreview'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-white" />
        <Sobre />
        <DiagonalDivider fromColor="bg-white" toColor="bg-iasd-dark" direction="top" />
        <AoVivo />
        <DiagonalDivider fromColor="bg-iasd-dark" toColor="bg-iasd-light" />
        <EstudosBiblicos />
        <SermoesPreview />
        <GaleriaPreview />
      </main>
      <Footer />
    </>
  )
}
