'use client'

import { useState } from 'react'
import type { CaseType } from '@/types'

interface TypeBannerProps {
  caseType: CaseType
  confidence: number
  detectionNote: string
  onConfirm: () => void
  onOverride: (type: CaseType) => void
}

const CASE_LABELS: Record<CaseType, string> = {
  A:  'ต่ออายุ อ.1 อย่างเดียว',
  B:  'ต่ออายุ อ.1 + แจ้งชื่อผู้ควบคุมใหม่',
  C:  'ต่ออายุ อ.1 + เปลี่ยนผู้ควบคุม',
  BC: 'ต่ออายุ อ.1 + แจ้งและเปลี่ยนผู้ควบคุม',
  D:  'ต่ออายุ ยผ.4 อย่างเดียว',
  E:  'ต่ออายุ ยผ.4 + แจ้งชื่อใหม่',
  F:  'ต่ออายุ ยผ.4 + เปลี่ยนผู้ควบคุม',
  unknown: 'ไม่สามารถระบุประเภทได้',
}

const ALL_TYPES: CaseType[] = ['A', 'B', 'C', 'BC', 'D', 'E', 'F']

export default function TypeBanner({
  caseType,
  confidence,
  detectionNote,
  onConfirm,
  onOverride,
}: TypeBannerProps) {
  const [overrideValue, setOverrideValue] = useState<CaseType>(caseType)
  const [showOverride, setShowOverride] = useState(false)

  const tier = confidence >= 80 ? 'high' : confidence >= 60 ? 'mid' : 'low'

  const colors = {
    high: {
      bg: 'bg-emerald-50 border-emerald-300',
      badge: 'bg-emerald-600 text-white',
      bar: 'bg-emerald-500',
      barBg: 'bg-emerald-200',
      icon: '✅',
      label: 'ความมั่นใจสูง',
      text: 'text-emerald-800',
      sub: 'text-emerald-600',
    },
    mid: {
      bg: 'bg-amber-50 border-amber-300',
      badge: 'bg-amber-500 text-white',
      bar: 'bg-amber-400',
      barBg: 'bg-amber-200',
      icon: '⚠️',
      label: 'ความมั่นใจปานกลาง',
      text: 'text-amber-800',
      sub: 'text-amber-600',
    },
    low: {
      bg: 'bg-red-50 border-red-300',
      badge: 'bg-red-600 text-white',
      bar: 'bg-red-500',
      barBg: 'bg-red-200',
      icon: '❗',
      label: 'ความมั่นใจต่ำ — ควรตรวจสอบ',
      text: 'text-red-800',
      sub: 'text-red-500',
    },
  }[tier]

  const handleOverride = () => {
    onOverride(overrideValue)
    setShowOverride(false)
  }

  return (
    <div className={`rounded-2xl border-2 ${colors.bg} overflow-hidden`}>
      {/* Header strip */}
      <div className={`px-5 py-3 flex items-center justify-between border-b ${colors.bg}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{colors.icon}</span>
          <span className={`text-xs font-semibold ${colors.sub}`}>{colors.label}</span>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${colors.badge}`}>
          {confidence}%
        </span>
      </div>

      {/* Main content */}
      <div className="px-5 py-4 space-y-3">
        {/* Case type */}
        <div className="flex items-start gap-3">
          <div className={`text-2xl font-black ${colors.text} leading-none`}>{caseType}</div>
          <div>
            <div className={`font-semibold text-base ${colors.text}`}>{CASE_LABELS[caseType]}</div>
            <div className={`text-xs mt-0.5 ${colors.sub}`}>{detectionNote}</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className={`h-2 rounded-full ${colors.barBg} overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all hover:shadow-md active:scale-[0.98]"
          >
            ถูกต้อง ✓
          </button>
          <button
            onClick={() => setShowOverride(v => !v)}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300 hover:border-slate-400 text-slate-600 text-sm font-medium transition-all hover:bg-slate-50"
          >
            เปลี่ยนประเภท ↓
          </button>
        </div>

        {/* Override dropdown */}
        {showOverride && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg space-y-2">
            <p className="text-xs font-semibold text-slate-500 mb-2">เลือกประเภทที่ถูกต้อง</p>
            <div className="grid grid-cols-1 gap-1">
              {ALL_TYPES.map(t => (
                <label
                  key={t}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                    ${overrideValue === t ? 'bg-blue-50 border border-blue-300' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <input
                    type="radio"
                    name="override"
                    value={t}
                    checked={overrideValue === t}
                    onChange={() => setOverrideValue(t)}
                    className="accent-blue-600"
                  />
                  <span className="font-bold text-slate-700 w-7">{t}</span>
                  <span className="text-sm text-slate-600">{CASE_LABELS[t]}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleOverride}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors mt-2"
            >
              ยืนยันการเปลี่ยนประเภท
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
