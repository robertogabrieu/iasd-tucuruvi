interface Opcao<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  /** Nome do que está sendo escolhido — vira o rótulo acessível do grupo. */
  label: string
  options: readonly Opcao<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

/**
 * Seletor de poucas opções mutuamente exclusivas, sempre visíveis — para quando a escolha
 * troca o que aparece abaixo dela e o custo de abrir um `Select` para descobrir as opções
 * não se justifica. Com mais de três opções, use `Select`.
 */
export default function SegmentedControl<T extends string>({
  label, options, value, onChange, disabled,
}: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-iasd-light p-1">
      {options.map(o => {
        const selecionada = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selecionada}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              selecionada
                ? 'bg-white text-iasd-dark shadow-sm'
                : 'text-gray-600 hover:text-iasd-dark'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
