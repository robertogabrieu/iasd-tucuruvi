import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function PainelLayout() {
  return (
    <div className="flex min-h-screen bg-iasd-light">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-8">
        <Outlet />
      </main>
    </div>
  )
}
