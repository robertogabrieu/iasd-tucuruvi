import { useEffect, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import Modal from './Modal'
import { Chip, Button, Alert } from '@/painel/ui'

interface Role { id: string; key: string; name: string }

export default function RolesModal(
  { userId, userName, current, onClose, onChanged }:
  { userId: string; userName: string; current: string[]; onClose: () => void; onChanged: () => void },
) {
  const [roles, setRoles] = useState<Role[]>([])
  const [mine, setMine] = useState<string[]>(current) // keys
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/roles')
      if (res.ok) setRoles((await res.json()).roles)
    })()
  }, [])

  async function add(role: Role) {
    setErr('')
    const res = await adminFetch(`/users/${userId}/roles`, { method: 'POST', body: JSON.stringify({ roleId: role.id }) })
    if (res.ok) { setMine(prev => [...new Set([...prev, role.key])]); onChanged() }
    else setErr('Não foi possível adicionar o papel.')
  }

  async function remove(role: Role) {
    setErr('')
    const res = await adminFetch(`/users/${userId}/roles/${role.id}`, { method: 'DELETE' })
    if (res.ok) { setMine(prev => prev.filter(k => k !== role.key)); onChanged() }
    else if (res.status === 409) setErr('Bloqueado: o sistema ficaria sem administrador.')
    else setErr('Não foi possível remover o papel.')
  }

  const available = roles.filter(r => !mine.includes(r.key))

  return (
    <Modal title={`Papéis — ${userName}`} onClose={onClose}>
      {err && <Alert message={{ kind: 'err', text: err }} />}
      <div className="flex flex-wrap gap-2 mb-4 mt-3">
        {mine.length === 0 && <span className="text-sm text-gray-500">Nenhum papel.</span>}
        {roles.filter(r => mine.includes(r.key)).map(r => (
          <Chip key={r.id} onRemove={() => remove(r)} removeLabel={`Remover ${r.name}`}>
            {r.name}
          </Chip>
        ))}
      </div>
      {available.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-sm mb-2">Adicionar papel:</p>
          <div className="flex flex-wrap gap-2">
            {available.map(r => (
              <Button key={r.id} variant="secondary" size="sm" onClick={() => add(r)}>
                + {r.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
