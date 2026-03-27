import { useState, useEffect } from 'react'

const schedule = [
  { day: 6, hour: 9, minute: 30, label: 'Culto de Sábado' },
  { day: 0, hour: 19, minute: 0, label: 'Culto de Domingo' },
  { day: 3, hour: 20, minute: 0, label: 'Culto de Quarta' },
]

function getNextService() {
  const now = new Date()

  let closest: { label: string; date: Date } | null = null

  for (const s of schedule) {
    const target = new Date(now)
    target.setHours(s.hour, s.minute, 0, 0)

    let diff = s.day - now.getDay()
    if (diff < 0) diff += 7
    if (diff === 0 && target <= now) diff = 7

    target.setDate(target.getDate() + diff)

    if (!closest || target < closest.date) {
      closest = { label: s.label, date: target }
    }
  }

  return closest!
}

function formatDiff(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds }
}

export default function Countdown() {
  const [next, setNext] = useState(getNextService)
  const [diff, setDiff] = useState(() => formatDiff(next.date.getTime() - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = next.date.getTime() - now

      if (remaining <= 0) {
        const updated = getNextService()
        setNext(updated)
        setDiff(formatDiff(updated.date.getTime() - now))
      } else {
        setDiff(formatDiff(remaining))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [next])

  const blocks = [
    { value: diff.days, label: 'dias' },
    { value: diff.hours, label: 'horas' },
    { value: diff.minutes, label: 'min' },
    { value: diff.seconds, label: 'seg' },
  ]

  return (
    <div className="mx-auto inline-block rounded-2xl border border-white/15 bg-white/10 px-8 py-5 backdrop-blur-sm">
      <p className="text-sm font-medium text-white/80">
        Próximo — <span className="font-bold text-white">{next.label}</span>
      </p>
      <div className="mt-3 flex justify-center gap-4">
        {blocks.map((b) => (
          <div key={b.label} className="min-w-[3.5rem]">
            <span className="block font-heading text-3xl font-bold text-white md:text-4xl">
              {String(b.value).padStart(2, '0')}
            </span>
            <span className="text-xs font-medium text-white/60">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
