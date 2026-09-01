import type { FormDefinition } from '../dto/form-definition.js'

export const estudosBiblicos: FormDefinition = {
  key: 'estudos-biblicos',
  label: 'Estudos Bíblicos',
  description: 'Pedidos de estudo bíblico feitos pela página principal do site',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, maxLength: 100, inList: true, searchable: true },
    { key: 'telefone', label: 'Telefone / WhatsApp', type: 'phone', required: true, maxLength: 15, inList: true, searchable: true },
    { key: 'email', label: 'E-mail', type: 'email', required: true, maxLength: 200, inList: true, searchable: true },
    {
      key: 'horario', label: 'Melhor horário para contato', type: 'choice', required: true, inList: true,
      options: ['Manhã', 'Tarde', 'Noite', 'Qualquer horário'],
    },
  ],
  notify: { subject: 'Novo pedido de estudo bíblico — Site IASD Tucuruvi' },
}
