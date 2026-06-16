// Catálogo versionado. Novas features só adicionam linhas aqui (sem migration).
export const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'users:read',    description: 'Listar usuários' },
  { key: 'users:invite',  description: 'Convidar novos usuários' },
  { key: 'roles:assign',  description: 'Atribuir/remover papéis' },
  { key: 'users:manage', description: 'Administrar contas (editar, ativar/desativar, desbloquear, redefinir senha)' },
  { key: 'roles:manage', description: 'Criar/editar papéis e suas permissões' },
  { key: 'boletim:write', description: 'Criar/editar boletins' },
  { key: 'settings:manage', description: 'Gerenciar configurações do sistema' },
]
