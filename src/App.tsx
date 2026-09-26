import { useEffect } from 'react'
import { Outlet, Route, createBrowserRouter, createRoutesFromElements, useLocation } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'

import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Sermoes from './pages/Sermoes'
import Galeria from './pages/Galeria'
import ASA from './pages/ASA'
import VidaESaude from './pages/VidaESaude'
import Desbravadores from './pages/Desbravadores'
import Especialidades from './pages/Especialidades'
import Aventureiros from './pages/Aventureiros'
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
import Midia from './painel/pages/Midia'
import EventosLista from './painel/pages/EventosLista'
import EventoEditor from './painel/pages/EventoEditor'
import EventoPreview from './painel/pages/EventoPreview'
import Eventos from './pages/Eventos'
import EventoPublico from './pages/EventoPublico'
import Boletins from './painel/pages/Boletins'
import BoletimEditor from './painel/pages/BoletimEditor'
import Templates from './painel/pages/Templates'
import Formularios from './painel/pages/Formularios'
import FormularioSubmissoes from './painel/pages/FormularioSubmissoes'
import BoletimPreview from './pages/BoletimPreview'
import BoletimPublico from './pages/BoletimPublico'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequirePermission } from './auth/RequirePermission'

// Páginas que abrem com hero de tela cheia: o header fica por cima da imagem,
// sem bloco atrás. As demais precisam do bloco — ver comentário abaixo.
const ROTAS_COM_HERO = ['/', '/asa', '/desbravadores', '/desbravadores/especialidades', '/aventureiros']

// Raiz de todas as rotas. Roda o AOS uma vez e é o limite de baixo de tudo que usa gancho de
// roteador: no roteador de dados não existe componente renderizado fora das rotas.
function RootLayout() {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: 'ease-out' })
  }, [])

  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  )
}

function PublicLayout() {
  const { pathname } = useLocation()
  // Páginas internas (sem hero) ganham um bloco azul sólido atrás do header fixo.
  // Como está no fluxo normal, ele sobe junto ao rolar — então no topo o header
  // semitransparente fica sobre azul sólido e, ao rolar, vira o glass sobre o conteúdo.
  const temHero = ROTAS_COM_HERO.includes(pathname)
  return (
    // Coluna com a janela como altura mínima: em tela de pouco conteúdo o miolo estica e o
    // rodapé encosta embaixo, em vez de subir até o meio e descer quando o conteúdo chega.
    <div className="flex min-h-dvh flex-col">
      <Header />
      {/* O que está aqui dentro apaga ao trocar de página; o header, que é fixo, apaga pela
          camada própria. Precisa esticar como coluna, senão o rodapé volta a subir em tela de
          pouco conteúdo. */}
      <div className="page-transition flex flex-1 flex-col">
        {!temHero && <div className="h-16 bg-iasd-dark" aria-hidden />}
        {/* O <main> da página também estica, para que o fundo dela — e não o do body — fique
            atrás do vazio. Página sem <main> na raiz cuida da própria altura. */}
        <div className="flex flex-1 flex-col [&>main]:flex-1">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  )
}

// Login, recuperação de senha e convite não têm moldura, mas o esmaecimento precisa de um
// elemento marcado para animar.
function AcessoLayout() {
  return (
    <div className="page-transition">
      <Outlet />
    </div>
  )
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sermoes" element={<Sermoes />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/asa" element={<ASA />} />
        <Route path="/vida-e-saude" element={<VidaESaude />} />
        <Route path="/desbravadores" element={<Desbravadores />} />
        <Route path="/desbravadores/especialidades" element={<Especialidades />} />
        <Route path="/aventureiros" element={<Aventureiros />} />
        <Route path="/boletins/:slug" element={<BoletimPublico />} />
        <Route path="/eventos" element={<Eventos />} />
        <Route path="/eventos/:slug" element={<EventoPublico />} />
      </Route>
      <Route element={<AcessoLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/aceitar-convite" element={<AceitarConvite />} />
      </Route>
      <Route path="/painel" element={<ProtectedRoute><PainelLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="usuarios" element={<RequirePermission perm="users:read"><UsuariosLista /></RequirePermission>} />
        <Route path="usuarios/convites" element={<RequirePermission perm="users:invite"><Convites /></RequirePermission>} />
        <Route path="usuarios/papeis" element={<RequirePermission perm="roles:manage"><Papeis /></RequirePermission>} />
        <Route path="usuarios/:id" element={<RequirePermission perm="users:read"><UsuarioDetalhe /></RequirePermission>} />
        <Route path="formularios" element={<RequirePermission perm="forms:read"><Formularios /></RequirePermission>} />
        <Route path="formularios/:formKey" element={<RequirePermission perm="forms:read"><FormularioSubmissoes /></RequirePermission>} />
        <Route path="midia" element={<RequirePermission perm="media:manage"><Midia /></RequirePermission>} />
        <Route path="boletins" element={<RequirePermission perm="boletim:write"><Boletins /></RequirePermission>} />
        <Route path="boletins/templates" element={<RequirePermission perm="boletim:templates:manage"><Templates /></RequirePermission>} />
        <Route path="boletins/templates/:id" element={<RequirePermission perm="boletim:templates:manage"><BoletimEditor mode="template" /></RequirePermission>} />
        {/* "novo" e ":id" renderizam o mesmo editor na mesma posição: ao trocar de /novo para /:id
            no primeiro Salvar, o React mantém o editor montado e o que está na tela não se perde.
            Envolver uma das duas num elemento diferente quebraria isso. */}
        <Route path="boletins/novo" element={<RequirePermission perm="boletim:write"><BoletimEditor /></RequirePermission>} />
        <Route path="boletins/:id" element={<RequirePermission perm="boletim:write"><BoletimEditor /></RequirePermission>} />
        <Route path="boletins/:id/preview" element={<RequirePermission perm="boletim:write"><BoletimPreview /></RequirePermission>} />
        <Route path="eventos" element={<RequirePermission perm="evento:write"><EventosLista /></RequirePermission>} />
        <Route path="eventos/novo" element={<RequirePermission perm="evento:write"><EventoEditor /></RequirePermission>} />
        <Route path="eventos/:id" element={<RequirePermission perm="evento:write"><EventoEditor /></RequirePermission>} />
        <Route path="eventos/:id/preview" element={<RequirePermission perm="evento:write"><EventoPreview /></RequirePermission>} />
        <Route path="*" element={<EmBreve />} />
      </Route>
    </Route>,
  ),
)
