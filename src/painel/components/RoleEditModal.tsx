import { useEffect, useState } from 'react'
import { ensureCsrf } from '@/auth/auth-api'
import { adminFetch } from '@/painel/admin-api'
import { Alert, Button, Field, Input, Modal } from '@/painel/ui'

interface Perm { key: string; description: string }
export interface ManagedRole { id: string; key: string; name: string; permissions: string[]; userCount: number; protected: boolean }

export default function RoleEditModal(
  { role, onClose, onChanged }: { role: ManagedRole; onClose: () => void; onChanged: () => void },
) {
  const [catalog, setCatalog] = useState<Perm[]>([])
  const [name, setName] = useState(role.name)
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions))
  const [confirmDel, setConfirmDel] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      await ensureCsrf()
      const res = await adminFetch('/permissions')
      if (res.ok) setCatalog((await res.json()).permissions)
    })()
  }, [])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setErr('')
    if (name !== role.name) {
      const res = await adminFetch(`/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
      if (!res.ok) { setErr('Não foi possível renomear.'); return }
    }
    const res = await adminFetch(`/roles/${role.id}/permissions`, {
      method: 'PUT', body: JSON.stringify({ permissionKeys: [...selected] }),
    })
    if (res.ok) { onChanged(); onClose() }
    else setErr('Não foi possível salvar as permissões.')
  }

  async function remove() {
    setErr('')
    const res = await adminFetch(`/roles/${role.id}`, { method: 'DELETE' })
    if (res.ok) { onChanged(); onClose() }
    else setErr('Não foi possível excluir.')
  }

  const ro = role.protected
  return (
    <Modal title={ro ? `Papel — ${role.name} (protegido)` : `Editar papel — ${role.name}`} onClose={onClose}>
      {err && <div className="mb-3"><Alert kind="err">{err}</Alert></div>}

      <div className="space-y-4">
        <Field label="Nome" htmlFor="role-edit-name">
          <Input
            id="role-edit-name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={ro}
          />
        </Field>

        <div>
          <p className="text-sm text-gray-600 mb-2">Permissões</p>
          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
            {catalog.map(p => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={ro ? true : selected.has(p.key)} disabled={ro}
                  onChange={() => toggle(p.key)} className="mt-1" />
                <span><code className="text-xs">{p.key}</code> — {p.description}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {!ro && (
        <div className="flex items-center justify-between mt-5">
          <div>
            {confirmDel ? (
              <span className="text-sm flex items-center gap-2">
                <span className="text-gray-600">{role.userCount} usuário(s) perderão este papel.</span>
                <Button variant="danger" size="sm" onClick={remove}>Confirmar exclusão</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
              </span>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>Excluir papel</Button>
            )}
          </div>
          <Button onClick={save}>Salvar</Button>
        </div>
      )}
    </Modal>
  )
}
