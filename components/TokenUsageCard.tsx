'use client'

import { AI_MODEL } from '@/lib/version'

export interface TokenUsage {
  gemini_input: number
  gemini_output: number
  extract_input: number
  extract_output: number
  cost_usd: number
  cost_thb: number
  pages_read?: number
  model?: string
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-slate-800 mt-0.5">{value}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  )
}

export default function TokenUsageCard({ usage }: { usage: TokenUsage }) {
  const model = usage.model ?? AI_MODEL
  const totalInput  = usage.gemini_input  + usage.extract_input
  const totalOutput = usage.gemini_output + usage.extract_output

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-bold text-violet-800">การใช้ AI</span>
          <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-medium">{model}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-black text-violet-700">
            {usage.cost_thb.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </span>
          <span className="text-[10px] text-violet-500 ml-1">บาท</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 py-4 grid grid-cols-4 gap-4 divide-x divide-slate-100">
        <Stat
          label="หน้าที่อ่าน"
          value={String(usage.pages_read ?? '—')}
          sub="images"
        />
        <div className="pl-4">
          <Stat
            label="Input tokens"
            value={totalInput.toLocaleString()}
            sub="รูป + prompt"
          />
        </div>
        <div className="pl-4">
          <Stat
            label="Output tokens"
            value={totalOutput.toLocaleString()}
            sub="ข้อความที่สร้าง"
          />
        </div>
        <div className="pl-4">
          <Stat
            label="ต้นทุน USD"
            value={`$${usage.cost_usd.toFixed(5)}`}
            sub={`≈ ${usage.cost_thb.toFixed(4)} บาท`}
          />
        </div>
      </div>

      {/* Bar — visual proportion */}
      <div className="px-5 pb-4">
        {totalInput + totalOutput > 0 && (
          <div className="flex rounded-full overflow-hidden h-1.5 bg-slate-100">
            <div
              className="bg-blue-400 transition-all"
              style={{ width: `${Math.round((totalInput / (totalInput + totalOutput)) * 100)}%` }}
            />
            <div className="bg-violet-400 flex-1" />
          </div>
        )}
        <div className="flex items-center gap-4 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[10px] text-slate-400">Input</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-[10px] text-slate-400">Output</span>
          </div>
        </div>
      </div>
    </div>
  )
}
