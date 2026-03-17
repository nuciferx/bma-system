'use client'

import { useState, useRef, useEffect } from 'react'

interface ThaiDatePickerProps {
  value: string
  onChange: (thaiDate: string) => void
  label: string
}

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
]



function parseThaiDate(str: string): Date | null {
  if (!str) return null
  const parts = str.trim().split(' ')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0])
  const month = THAI_MONTHS.indexOf(parts[1])
  const year = parseInt(parts[2]) - 543
  if (isNaN(day) || month === -1 || isNaN(year)) return null
  return new Date(year, month, day)
}

function formatThaiDate(date: Date): string {
  const day = date.getDate()
  const month = THAI_MONTHS[date.getMonth()]
  const year = date.getFullYear() + 543
  return `${day} ${month} ${year}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export default function ThaiDatePicker({ value, onChange, label }: ThaiDatePickerProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const parsed = parseThaiDate(value)
  const initial = parsed ?? today

  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [selected, setSelected] = useState<Date | null>(parsed)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = parseThaiDate(value)
    if (p) {
      setSelected(p)
      setViewYear(p.getFullYear())
      setViewMonth(p.getMonth())
    }
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    setSelected(d)
    onChange(formatThaiDate(d))
    setOpen(false)
  }

  const thaiYear = viewYear + 543
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isSelected = (day: number) =>
    selected && selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth && selected.getDate() === day

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth && today.getDate() === day

  return (
    <div ref={ref} className="relative">
      {/* Input */}
      <div>
        {label && (
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
        )}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all text-sm
            ${open ? 'border-blue-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white'}`}
        >
          <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>
            {value || 'เลือกวันที่'}
          </span>
          <span className="text-slate-400 text-base">📅</span>
        </button>
      </div>

      {/* Dropdown Calendar */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-lg">
              ‹
            </button>
            <div className="text-center">
              <div className="font-bold text-sm">{THAI_MONTHS[viewMonth]}</div>
              <div className="text-xs text-blue-200">{thaiYear}</div>
            </div>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-lg">
              ›
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {['อา','จ','อ','พ','พฤ','ศ','ส'].map((d, i) => (
              <div key={d} className={`text-center text-xs py-2 font-semibold
                ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 p-2 gap-0.5">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />
              const sel = isSelected(day)
              const tod = isToday(day)
              const sun = (i % 7) === 0
              const sat = (i % 7) === 6
              return (
                <button
                  key={day}
                  onClick={() => selectDay(day)}
                  className={`h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-all
                    ${sel ? 'bg-blue-600 text-white shadow-md' : ''}
                    ${!sel && tod ? 'border-2 border-blue-400 text-blue-600' : ''}
                    ${!sel && !tod && sun ? 'text-red-400 hover:bg-red-50' : ''}
                    ${!sel && !tod && sat ? 'text-blue-400 hover:bg-blue-50' : ''}
                    ${!sel && !tod && !sun && !sat ? 'text-slate-700 hover:bg-slate-100' : ''}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick Today */}
          <div className="px-3 pb-3">
            <button
              onClick={() => { const d = new Date(); selectDay(d.getDate()); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }}
              className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
