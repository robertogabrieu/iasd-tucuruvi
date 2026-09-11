import type { FormDefinition } from '../dto/form-definition.js'

/**
 * Os grupos de caixas de seleção da página chegam como uma string com os itens separados por
 * vírgula: o motor trata todo campo como texto, e abrir exceção para lista atravessaria
 * validação, listagem, exportação e filtro. Marcados como busca livre, continuam encontráveis
 * pelo nome do item ("Alimentos", "Crianças").
 */
export const asa: FormDefinition = {
  key: 'asa',
  label: 'Pedidos de ajuda — ASA',
  description: 'Pedidos de ajuda enviados pela página da Ação Solidária Adventista',
  fields: [
    { key: 'nome', label: 'Nome completo', type: 'text', required: true, maxLength: 120, inList: true, searchable: true },
    { key: 'telefone', label: 'Telefone / WhatsApp', type: 'phone', required: true, maxLength: 20, inList: true, searchable: true },
    { key: 'email', label: 'E-mail', type: 'email', maxLength: 200, searchable: true },
    { key: 'bairro', label: 'Bairro onde mora', type: 'text', required: true, maxLength: 120, searchable: true },
    { key: 'endereco', label: 'Endereço', type: 'text', maxLength: 200, searchable: true },
    {
      key: 'horario', label: 'Melhor horário para contato', type: 'choice', required: true,
      options: ['Manhã', 'Tarde', 'Noite', 'Qualquer horário'],
    },
    {
      key: 'pessoas', label: 'Pessoas na casa', type: 'choice', required: true,
      options: ['Moro sozinho(a)', '2 pessoas', '3 pessoas', '4 pessoas', '5 pessoas', '6 ou mais'],
    },
    { key: 'perfil', label: 'Há na casa', type: 'text', maxLength: 200, searchable: true },
    { key: 'ajuda', label: 'Tipo de ajuda', type: 'text', required: true, maxLength: 200, inList: true, searchable: true },
    { key: 'situacao', label: 'Situação relatada', type: 'longtext', required: true, maxLength: 1000, searchable: true },
    {
      key: 'urgencia', label: 'Urgência', type: 'choice', required: true, inList: true,
      options: [
        'Preciso de ajuda ainda esta semana',
        'Preciso de ajuda neste mês',
        'Não é urgente, mas preciso de apoio contínuo',
      ],
    },
    {
      key: 'consentimento', label: 'Autorizou o contato', type: 'choice', required: true,
      options: ['Sim'],
    },
  ],
  notify: { subject: 'Novo pedido de ajuda à ASA — Site IASD Tucuruvi' },
}
