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
import PainelLayout from './painel/PainelLayout'
import Dashboard from './painel/pages/Dashboard'
import Configuracoes from './painel/pages/Configuracoes'
import EmBreve from './painel/pages/EmBreve'
import UsuariosLista from './painel/pages/UsuariosLista'
import UsuarioDetalhe from './painel/pages/UsuarioDetalhe'
import Convites from './painel/pages/Convites'
import Papeis from './painel/pages/Papeis'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequirePermission } from './auth/RequirePermission'

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
        <Route path="/painel" element={<ProtectedRoute><PainelLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="usuarios" element={<RequirePermission perm="users:read"><UsuariosLista /></RequirePermission>} />
          <Route path="usuarios/convites" element={<RequirePermission perm="users:invite"><Convites /></RequirePermission>} />
          <Route path="usuarios/papeis" element={<RequirePermission perm="roles:manage"><Papeis /></RequirePermission>} />
          <Route path="usuarios/:id" element={<RequirePermission perm="users:read"><UsuarioDetalhe /></RequirePermission>} />
          <Route path="*" element={<EmBreve />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
