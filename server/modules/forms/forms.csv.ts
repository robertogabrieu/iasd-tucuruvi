import type { FormDefinition } from './dto/form-definition.js'
import type { SubmissionRow } from './dto/submission-row.js'

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * O dado vem de formulário aberto na internet: valor começando com sinal de cálculo é executado
 * pela planilha ao abrir. O apóstrofo à frente faz o Excel tratar como texto.
 */
function escapeCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Com as duas colunas nulas há dois casos distintos: o formulário não avisa ninguém, ou o aviso
 * ainda está em curso. Chamar os dois de "não configurado" faz o envio recente parecer mal
 * configurado — quem confere sai atrás de um problema que não existe.
 */
function notifyLabel(def: FormDefinition, row: SubmissionRow): string {
  if (row.notified_at) return 'Enviado'
  if (row.notify_error) return 'Falhou'
  return def.notify ? 'Pendente' : 'Não configurado'
}

function formatDate(d: Date): string {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return f.format(d).replace(', ', ' ')
}

/**
 * Separador `;` e BOM UTF-8: é o que faz o Excel em português abrir com as colunas separadas e a
 * acentuação certa. Vírgula e sem BOM produzem uma coluna só, com os acentos corrompidos.
 * O endereço de origem fica de fora de propósito — ele não sai do sistema.
 */
export function toCsv(def: FormDefinition, rows: SubmissionRow[]): string {
  const header = ['Recebido em', ...def.fields.map(f => f.label), 'Aviso por e-mail']
  const lines = [header.map(escapeCell).join(';')]
  for (const row of rows) {
    lines.push([
      formatDate(row.created_at),
      ...def.fields.map(f => row.data[f.key] ?? ''),
      notifyLabel(def, row),
    ].map(escapeCell).join(';'))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
