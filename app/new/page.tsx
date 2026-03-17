'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'


interface CaseSummary {
  id: string
  permit_no: string
  owner_name: string
  case_type: string
  receipt_date: string
  renew_to: string
  created_at: string
}

interface Metrics {
  this_month_count: number
  pending_count: number
  ai_cost_thb: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [metrics, setMetrics] = useState<Metrics>({ this_month_count: 0, pending_count: 0, ai_cost_thb: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/cases')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setCases(data.cases ?? [])
        setMetrics(data.metrics ?? { this_month_count: 0, pending_count: 0, ai_cost_thb: 0 })
      } catch (e) {
        setError('โหลดข้อมูลไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = cases.filter(c =>
    c.permit_no.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_name.toLowerCase().includes(search.toLowerCase())
  )

  const CASE_TYPE_COLORS: Record<string, string> = {
    A: 'bg-sky-100 text-sky-700',
    B: 'bg-violet-100 text-violet-700',
    C: 'bg-orange-100 text-orange-700',
    BC: 'bg-pink-100 text-pink-700',
    D: 'bg-teal-100 text-teal-700',
    E: 'bg-amber-100 text-amber-700',
    F: 'bg-red-100 text-red-700',
    unknown: 'bg-slate-100 text-slate-500',
  }

  const metricCards = [
    {
      title: 'บันทึกเดือนนี้',
      value: metrics.this_month_count.toLocaleString(),
      unit: 'เรื่อง',
      icon: '📋',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'รอดำเนินการ',
      value: metrics.pending_count.toLocaleString(),
      unit: 'เรื่อง',
      icon: '⏳',
      color: 'from-amber-400 to-amber-500',
    },
    {
      title: 'ต้นทุน AI เดือนนี้',
      value: metrics.ai_cost_thb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unit: 'บาท',
      icon: '🤖',
      color: 'from-purple-500 to-purple-600',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">
            ก
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">ระบบงานอาคาร BMA</h1>
            <p className="text-xs text-slate-400 mt-0.5">กรุงเทพมหานคร</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>+</span>
          <span>เพิ่มอาคารใหม่</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-7">
        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-4">
          {metricCards.map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`h-1.5 w-full bg-gradient-to-r ${card.color}`} />
              <div className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{card.title}</p>
                    <p className="text-3xl font-black text-slate-800 mt-1 leading-none">{card.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{card.unit}</p>
                  </div>
                  <span className="text-2xl">{card.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาเลขที่อนุญาต หรือชื่อเจ้าของ…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-400 shadow-sm transition-colors"
          />
        </div>

        {/* Cases List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700 text-sm">รายการล่าสุด</h2>
            {!loading && (
              <span className="text-xs text-slate-400">{filtered.length} รายการ</span>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              กำลังโหลด…
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-red-400 gap-2">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
              <span className="text-4xl">📂</span>
              <p className="text-sm text-slate-400">
                {search ? 'ไม่พบผลลัพธ์ที่ตรงกัน' : 'ยังไม่มีข้อมูล'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/case/${c.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50/60 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800 text-sm truncate">{c.permit_no}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0
                        ${CASE_TYPE_COLORS[c.case_type] ?? CASE_TYPE_COLORS.unknown}`}>
                        {c.case_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.owner_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">รับ {c.receipt_date}</p>
                    <p className="text-xs text-slate-400 mt-0.5">ถึง {c.renew_to}</p>
                  </div>
                  <span className="text-slate-300 group-hover:text-blue-400 transition-colors text-lg">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
