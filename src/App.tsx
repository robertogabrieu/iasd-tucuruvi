import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'

import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Sermoes from './pages/Sermoes'
import Galeria from './pages/Galeria'
import Desbravadores from './pages/Desbravadores'
import Coral from './pages/Coral'

export default function App() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sermoes" element={<Sermoes />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/desbravadores" element={<Desbravadores />} />
        <Route path="/coral" element={<Coral />} />
      </Routes>
      <Footer />
    </>
  )
}
