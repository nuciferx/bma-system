'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Building, Action, CaseType } from '@/types'
import Sidebar from '@/components/Sidebar'

interface CaseDetail {
  building: Building
  actions: Action[]
  attachments?: Array<{ attach_id: string; file_name: string; public_url: string; note: string; uploaded_at: string }>
}

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  A: 'ต่ออายุ อ.1',
  B: 'ต่ออายุ อ.1 + แจ้งชื่อผู้ควบคุม',
  C: 'ต่ออายุ อ.1 + เปลี่ยนผู้ควบคุม',
  BC: 'ต่ออายุ อ.1 + แจ้งและเปลี่ยน',
  D: 'ต่ออายุ ยผ.4',
  E: 'ต่ออายุ ยผ.4 + แจ้งชื่อ',
  F: 'ต่ออายุ ยผ.4 + เปลี่ยนผู้ควบคุม',
  unknown: 'ไม่ระบุ',
}

const CASE_COLORS: Record<CaseType, string> = {
  A: 'bg-sky-100 text-sky-700',
  B: 'bg-violet-100 text-violet-700',
  C: 'bg-orange-100 text-orange-700',
  BC: 'bg-pink-100 text-pink-700',
  D: 'bg-teal-100 text-teal-700',
  E: 'bg-amber-100 text-amber-700',
  F: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-500',
}

function CaseDetailContent() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const section = searchParams.get('section') ?? 'home'

  const [data, setData] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'docs'>('info')
  const [supNoticeLoading, setSupNoticeLoading] = useState(false)
  const [supNoticeError, setSupNoticeError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data?: CaseDetail; error?: string }) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Not found')
        setData(json.data)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleNavigate = (s: string) => {
    router.push(s === 'home' ? '/' : `/?section=${s}`)
    setSidebarOpen(false)
  }

  const handleDownloadSupNotice = async (action: Action) => {
    if (!action?.form_data_snapshot) return
    setSupNoticeLoading(true)
    setSupNoticeError(null)
    try {
      const res = await fetch('/api/supervisor-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: action.form_data_snapshot }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : 'บันทึกแจ้งผู้ควบคุม.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setSupNoticeError(e instanceof Error ? e.message : 'สร้างเอกสารไม่สำเร็จ')
    } finally {
      setSupNoticeLoading(false)
    }
  }

  const sidebarProps = {
    activeSection: section,
    onNavigate: handleNavigate,
    onNewCase: () => router.push('/new'),
    isOpen: sidebarOpen,
    onClose: () => setSidebarOpen(false),
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar {...sidebarProps} />
        <div className="flex-1 lg:ml-64 flex items-center justify-center text-slate-400">
          <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          กำลังโหลด…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar {...sidebarProps} />
        <div className="flex-1 lg:ml-64 flex flex-col items-center justify-center gap-3 text-slate-400">
          <span className="text-4xl">⚠️</span>
          <p>{error ?? 'ไม่พบข้อมูล'}</p>
          <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">
            กลับหน้าก่อน
          </button>
        </div>
      </div>
    )
  }

  const { building, actions } = data
  const latestAction = actions[0]

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar {...sidebarProps} />

      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-800 text-xl leading-none"
          >
            ☰
          </button>
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none"
          >
            ←
          </button>
          <span className="font-semibold text-slate-700 text-sm truncate flex-1">{building.permit_no}</span>
        </div>

        {/* Desktop title bar */}
        <div className="hidden lg:flex sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 items-center gap-4 shadow-sm">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none"
          >
            ←
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800 truncate">{building.permit_no}</h1>
            {latestAction && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${CASE_COLORS[latestAction.case_type]}`}>
                {latestAction.case_type}
              </span>
            )}
            <p className="text-xs text-slate-400 truncate">{building.owner_name}</p>
          </div>
          {latestAction?.doc_url && (
            <a
              href={latestAction.doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
            >
              <span>📄</span> ดาวน์โหลด
            </a>
          )}
        </div>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          {/* Building summary card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="เจ้าของ" value={building.owner_name} />
            <InfoRow label="ผู้รับมอบอำนาจ" value={building.owner_rep || '-'} />
            <InfoRow label="แบบใบอนุญาต" value={building.permit_form} />
            <InfoRow label="วันที่ออก" value={building.permit_date} />
            <InfoRow
              label="ที่ตั้ง"
              value={[building.location_soi, building.location_road, building.location_subdistrict, building.location_district]
                .filter(Boolean)
                .join(' ')}
            />
            <InfoRow label="รายละเอียดอาคาร" value={building.building_desc} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
            {([
              { key: 'info', label: 'ครั้งล่าสุด' },
              { key: 'history', label: `ประวัติทั้งหมด (${actions.length})` },
              { key: 'docs', label: 'เอกสาร' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                  ${activeTab === tab.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Latest action */}
          {activeTab === 'info' && latestAction && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CASE_COLORS[latestAction.case_type]}`}>
                    {latestAction.case_type}
                  </span>
                  <span className="text-slate-500">{CASE_TYPE_LABELS[latestAction.case_type]}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <InfoRow label="เลขรับ" value={latestAction.receipt_no} />
                  <InfoRow label="วันที่รับ" value={latestAction.receipt_date} />
                  <InfoRow label="ต่ออายุครั้งที่" value={latestAction.renew_count} />
                  <InfoRow label="ค่าธรรมเนียม" value={latestAction.fee ? `${latestAction.fee} บาท` : '-'} />
                  <InfoRow label="ตั้งแต่" value={latestAction.renew_from} />
                  <InfoRow label="ถึงวันที่" value={latestAction.renew_to} />
                  <InfoRow label="EIA" value={latestAction.eia_status === 'approved' ? '✅ ได้รับความเห็นชอบ' : 'ไม่มี'} />
                  <InfoRow label="ร้องเรียน" value={latestAction.complaint === 'found' ? `⚠ ${latestAction.complaint_detail ?? ''}` : 'ไม่พบ'} />
                </div>
                {latestAction.construction_status && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">สภาพการก่อสร้าง</p>
                    <p className="text-slate-700">{latestAction.construction_status}</p>
                  </div>
                )}
              </div>

              {/* Supervisors snapshot */}
              {latestAction.supervisors_snapshot.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-xs font-bold text-slate-500 mb-3">ผู้ควบคุมงาน ณ เวลานั้น</p>
                  <div className="space-y-2">
                    {latestAction.supervisors_snapshot.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-slate-400">({s.reg_no})</span>
                        <span className="text-slate-400 text-xs">{s.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supervisor changes */}
              {latestAction.supervisor_changes.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500">การแจ้ง/เปลี่ยนผู้ควบคุมครั้งนี้</p>
                    <button
                      onClick={() => handleDownloadSupNotice(latestAction)}
                      disabled={supNoticeLoading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${supNoticeLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}
                    >
                      {supNoticeLoading ? '…' : '📄 บันทึกแจ้งผู้ควบคุม'}
                    </button>
                  </div>
                  {supNoticeError && (
                    <p className="text-xs text-red-500 mb-2">{supNoticeError}</p>
                  )}
                  {latestAction.supervisor_changes.map((sc, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sc.action === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {sc.action === 'new' ? 'แจ้งชื่อใหม่' : 'เปลี่ยนตัว'}
                        </span>
                        <span className="text-slate-500 text-xs">เลขรับ {sc.notice_receipt_no}</span>
                      </div>
                      {sc.action === 'new' && (
                        <p className="text-slate-700">
                          {(sc.new_supervisors ?? []).map((s) => `${s.name} (${s.reg_no})`).join(', ')}
                        </p>
                      )}
                      {sc.action === 'change' && (
                        <p className="text-slate-700">
                          {sc.from_supervisor?.name} → {sc.to_supervisor?.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: History */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {actions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">ไม่มีประวัติ</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {actions.map((a, i) => (
                    <div key={a.action_id} className="px-5 py-4 flex items-center gap-4 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {actions.length - i}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CASE_COLORS[a.case_type]}`}>
                            {a.case_type}
                          </span>
                          <span className="text-slate-600 font-medium">ครั้งที่ {a.renew_count}</span>
                          {i === 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">ล่าสุด</span>}
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">เลขรับ {a.receipt_no} · {a.receipt_date}</p>
                      </div>
                      <div className="text-right text-xs text-slate-400 flex-shrink-0">
                        <p>{a.renew_from}</p>
                        <p>ถึง {a.renew_to}</p>
                      </div>
                      {a.doc_url && (
                        <a
                          href={a.doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-xs flex-shrink-0"
                        >
                          📄
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Docs */}
          {activeTab === 'docs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {(!data.attachments || data.attachments.length === 0) && !latestAction?.doc_url ? (
                <div className="py-12 text-center text-slate-400 text-sm">ไม่มีเอกสาร</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {latestAction?.doc_url && (
                    <div className="px-5 py-4 flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">บันทึกข้อความล่าสุด</p>
                        <p className="text-xs text-slate-400">{latestAction.doc_date}</p>
                      </div>
                      <a
                        href={latestAction.doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      >
                        ดาวน์โหลด
                      </a>
                    </div>
                  )}
                  {latestAction?.supervisor_changes && latestAction.supervisor_changes.length > 0 && (
                    <div className="px-5 py-4 flex items-center gap-3 border-t border-slate-100">
                      <span className="text-2xl">📋</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">บันทึกแจ้ง/เปลี่ยนผู้ควบคุมงาน</p>
                        <p className="text-xs text-slate-400">สร้างจากข้อมูลครั้งล่าสุด</p>
                      </div>
                      <button
                        onClick={() => handleDownloadSupNotice(latestAction)}
                        disabled={supNoticeLoading}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                          ${supNoticeLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}
                      >
                        {supNoticeLoading ? 'กำลังสร้าง…' : 'สร้าง & ดาวน์โหลด'}
                      </button>
                    </div>
                  )}
                  {(data.attachments ?? []).map((att) => (
                    <div key={att.attach_id} className="px-5 py-4 flex items-center gap-3">
                      <span className="text-2xl">📎</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{att.file_name}</p>
                        {att.note && <p className="text-xs text-slate-400">{att.note}</p>}
                      </div>
                      <a
                        href={att.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      >
                        เปิด
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function CaseDetailPage() {
  return (
    <Suspense>
      <CaseDetailContent />
    </Suspense>
  )
}

// ─── Helper ───────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="text-slate-800 mt-0.5">{value || '-'}</p>
    </div>
  )
}
