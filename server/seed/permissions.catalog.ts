// Catálogo versionado. Novas features só adicionam linhas aqui (sem migration).
export const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'users:read',    description: 'Listar usuários' },
  { key: 'users:invite',  description: 'Convidar novos usuários' },
  { key: 'roles:assign',  description: 'Atribuir/remover papéis' },
  { key: 'boletim:write', description: 'Criar/editar boletins' },
]
