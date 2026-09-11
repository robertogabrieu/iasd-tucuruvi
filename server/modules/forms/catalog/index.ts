import type { FormDefinition } from '../dto/form-definition.js'
import { estudosBiblicos } from './estudos-biblicos.js'

/**
 * Catálogo dos formulários do site. Formulário novo = um arquivo nesta pasta e uma linha aqui;
 * listagem, filtros e exportação passam a funcionar sem tocar em nenhuma tela.
 */
export const FORMS: FormDefinition[] = [estudosBiblicos]

export function findForm(key: string): FormDefinition | undefined {
  return FORMS.find(f => f.key === key)
}
