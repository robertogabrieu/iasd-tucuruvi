interface DiagonalDividerProps {
  fromColor?: string
  toColor?: string
  direction?: 'top' | 'bottom'
}

export default function DiagonalDivider({
  fromColor = 'bg-iasd-dark',
  toColor = 'bg-white',
  direction = 'bottom',
}: DiagonalDividerProps) {
  const clipClass = direction === 'bottom' ? 'diagonal-bottom' : 'diagonal-top'
  return (
    <div className="relative -mt-1">
      <div className={`${fromColor} h-20 ${clipClass}`} />
    </div>
  )
}
