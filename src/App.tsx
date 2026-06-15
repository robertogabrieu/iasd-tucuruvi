import { useEffect } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'

import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Sermoes from './pages/Sermoes'
import Galeria from './pages/Galeria'
import Login from './pages/Login'
import EsqueciSenha from './pages/EsqueciSenha'
import RedefinirSenha from './pages/RedefinirSenha'
import AceitarConvite from './pages/AceitarConvite'
import Painel from './pages/Painel'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'

function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  )
}

export default function App() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/sermoes" element={<Sermoes />} />
          <Route path="/galeria" element={<Galeria />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/aceitar-convite" element={<AceitarConvite />} />
        <Route path="/painel" element={<ProtectedRoute><Painel /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
