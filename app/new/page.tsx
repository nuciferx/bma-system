'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import TypeBanner from '@/components/TypeBanner'
import SupervisorList from '@/components/SupervisorList'
import ThaiDatePicker from '@/components/ThaiDatePicker'
import type { OcrRequest, OcrResponse, FormData, CaseType, Supervisor } from '@/types'

type Step = 'upload' | 'review'

const EMPTY_FORM: FormData = {
  doc_date: '',
  officer_name: '',
  officer_position: '',
  owner_name: '',
  owner_rep: '',
  permit_no: '',
  permit_form: 'อ.1',
  permit_date: '',
  permit_expire: '',
  building_desc: '',
  location_soi: '',
  location_road: '',
  location_subdistrict: '',
  location_district: '',
  receipt_no: '',
  receipt_date: '',
  renew_count: '',
  renew_from: '',
  renew_to: '',
  fee: '',
  original_supervisors: [],
  orig_sup_status: 'none',
  supervisor_changes: [],
  supervisor_history: [],
  eia_status: 'none',
  traffic_status: 'none',
  construction_status: '',
  complaint: 'none',
}

function Field({ label, value, onChange, placeholder, highlight }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  highlight?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-sm transition-all focus:outline-none
          ${highlight
            ? 'border-amber-300 bg-amber-50 focus:border-amber-400'
            : 'border-slate-200 bg-white focus:border-blue-400'}`}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function SupervisorRow({ sup, onChange, onRemove }: {
  sup: Supervisor
  onChange: (s: Supervisor) => void
  onRemove: () => void
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500">ผู้ควบคุมงาน</span>
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors text-sm">×</button>
      </div>
      <input
        type="text" placeholder="ชื่อ-นามสกุล"
        value={sup.name} onChange={e => onChange({ ...sup, name: e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" placeholder="เลขทะเบียน เช่น สย.99999"
          value={sup.reg_no} onChange={e => onChange({ ...sup, reg_no: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
        <input
          type="text" placeholder="บทบาท เช่น วิศวกรโครงสร้าง"
          value={sup.role} onChange={e => onChange({ ...sup, role: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
      </div>
    </div>
  )
}

export default function NewCasePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  const [caseType, setCaseType] = useState<CaseType>('A')
  const [confidence, setConfidence] = useState(0)
  const [detectionNote, setDetectionNote] = useState('')
  const [typeConfirmed, setTypeConfirmed] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])

  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const set = (key: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const isHighlight = (field: string) => missingFields.includes(field)

  // ── OCR ────────────────────────────────────────────────────
  const handleOcr = async (req: OcrRequest) => {
    setOcrLoading(true)
    setOcrError(null)
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      const data: OcrResponse = await res.json()
      if (!data.success) throw new Error(data.error ?? 'OCR failed')
      setCaseType(data.case_type)
      setConfidence(data.detection_confidence)
      setDetectionNote(data.detection_note)
      setMissingFields(data.missing_fields ?? [])
      setForm({ ...EMPTY_FORM, ...data.form_data })
      setStep('review')
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : 'OCR ล้มเหลว')
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: form, caseType, saveToDb: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      router.push(`/case/${data.building_id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  // ── Upload Step ─────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-slate-600 transition-colors text-xl">←</button>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">เพิ่มอาคารใหม่</h1>
            <p className="text-xs text-slate-400 mt-0.5">อัปโหลดเอกสารเพื่อวิเคราะห์</p>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <UploadZone onSubmit={handleOcr} isLoading={ocrLoading} />
          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
              <span>⚠️</span> {ocrError}
            </div>
          )}
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setConfidence(0); setDetectionNote('กรอกข้อมูลเอง'); setTypeConfirmed(true); setStep('review') }}
            className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-2xl text-sm font-medium transition-all hover:bg-blue-50"
          >
            ✏️ กรอกข้อมูลเองโดยไม่สแกน
          </button>
        </main>
      </div>
    )
  }

  // ── Review Step ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button onClick={() => setStep('upload')} className="text-slate-400 hover:text-slate-600 transition-colors text-xl">←</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800 leading-none">ตรวจสอบและบันทึก</h1>
          <p className="text-xs text-slate-400 mt-0.5">แก้ไขข้อมูลที่ต้องการแล้วกดบันทึก</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md
            ${saving ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}
        >
          {saving ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> กำลังบันทึก…</>
          ) : 'บันทึก'}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Type Banner */}
        {!typeConfirmed && confidence > 0 && (
          <TypeBanner
            caseType={caseType}
            confidence={confidence}
            detectionNote={detectionNote}
            onConfirm={() => setTypeConfirmed(true)}
            onOverride={(t) => { setCaseType(t); setTypeConfirmed(true) }}
          />
        )}

        {/* Case Type (manual) */}
        {(typeConfirmed || confidence === 0) && (
          <Section title="ประเภทเรื่อง">
            <div className="flex flex-wrap gap-2">
              {(['A','B','C','BC','D','E','F'] as CaseType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setCaseType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                    ${caseType === t ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Save error */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <span>⚠️</span> {saveError}
          </div>
        )}

        {/* Missing fields notice */}
        {missingFields.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <div><span className="font-semibold">ช่องที่ยังขาด:</span> {missingFields.join(', ')}</div>
          </div>
        )}

        {/* Header Section */}
        <Section title="ข้อมูลบันทึก">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <ThaiDatePicker label="วันที่บันทึก" value={form.doc_date} onChange={v => set('doc_date', v)} />
            </div>
            <Field label="ชื่อเจ้าหน้าที่" value={form.officer_name} onChange={v => set('officer_name', v)} highlight={isHighlight('officer_name')} />
            <Field label="ตำแหน่ง" value={form.officer_position} onChange={v => set('officer_position', v)} highlight={isHighlight('officer_position')} />
          </div>
        </Section>

        {/* Owner Section */}
        <Section title="เจ้าของอาคาร">
          <Field label="ชื่อเจ้าของ / นิติบุคคล" value={form.owner_name} onChange={v => set('owner_name', v)} highlight={isHighlight('owner_name')} />
          <Field label="ผู้แทน (ถ้ามี)" value={form.owner_rep} onChange={v => set('owner_rep', v)} placeholder="เว้นว่างถ้าไม่มี" />
        </Section>

        {/* Permit Section */}
        <Section title="ใบอนุญาต">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="เลขที่ใบอนุญาต" value={form.permit_no} onChange={v => set('permit_no', v)} highlight={isHighlight('permit_no')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">แบบใบอนุญาต</label>
              <select
                value={form.permit_form}
                onChange={e => set('permit_form', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="อ.1">อ.1</option>
                <option value="ยผ.4">ยผ.4</option>
              </select>
            </div>
            <Field label="วันที่ออกใบอนุญาต" value={form.permit_date} onChange={v => set('permit_date', v)} placeholder="วว/ดด/ปปปป" highlight={isHighlight('permit_date')} />
            <div className="col-span-2">
              <Field label="วันสิ้นอายุใบอนุญาต" value={form.permit_expire} onChange={v => set('permit_expire', v)} placeholder="วว/ดด/ปปปป" highlight={isHighlight('permit_expire')} />
            </div>
            <div className="col-span-2">
              <Field label="รายละเอียดอาคาร" value={form.building_desc} onChange={v => set('building_desc', v)} highlight={isHighlight('building_desc')} />
            </div>
          </div>
        </Section>

        {/* Location Section */}
        <Section title="ที่ตั้งอาคาร">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ซอย" value={form.location_soi} onChange={v => set('location_soi', v)} />
            <Field label="ถนน" value={form.location_road} onChange={v => set('location_road', v)} highlight={isHighlight('location_road')} />
            <Field label="แขวง" value={form.location_subdistrict} onChange={v => set('location_subdistrict', v)} highlight={isHighlight('location_subdistrict')} />
            <Field label="เขต" value={form.location_district} onChange={v => set('location_district', v)} highlight={isHighlight('location_district')} />
          </div>
        </Section>

        {/* Request Section */}
        <Section title="คำขอครั้งนี้">
          <div className="grid grid-cols-2 gap-4">
            <Field label="เลขรับ" value={form.receipt_no} onChange={v => set('receipt_no', v)} highlight={isHighlight('receipt_no')} />
            <Field label="วันที่รับ" value={form.receipt_date} onChange={v => set('receipt_date', v)} placeholder="วว/ดด/ปปปป" highlight={isHighlight('receipt_date')} />
            <Field label="ต่ออายุครั้งที่" value={form.renew_count} onChange={v => set('renew_count', v)} highlight={isHighlight('renew_count')} />
            <Field label="ค่าธรรมเนียม (บาท)" value={form.fee} onChange={v => set('fee', v)} highlight={isHighlight('fee')} />
            <Field label="ต่ออายุตั้งแต่" value={form.renew_from} onChange={v => set('renew_from', v)} placeholder="วว/ดด/ปปปป" highlight={isHighlight('renew_from')} />
            <Field label="ถึงวันที่" value={form.renew_to} onChange={v => set('renew_to', v)} placeholder="วว/ดด/ปปปป" highlight={isHighlight('renew_to')} />
          </div>
        </Section>

        {/* Original Supervisors */}
        <Section title="ผู้ควบคุมงานตามใบอนุญาตเดิม">
          <div className="flex gap-3 mb-3">
            {(['have', 'none'] as const).map(v => (
              <button
                key={v}
                onClick={() => set('orig_sup_status', v)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                  ${form.orig_sup_status === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
              >
                {v === 'have' ? 'มีผู้ควบคุม' : 'ยังไม่มี'}
              </button>
            ))}
          </div>
          {form.orig_sup_status === 'have' && (
            <div className="space-y-3">
              {form.original_supervisors.map((sup, i) => (
                <SupervisorRow
                  key={i}
                  sup={sup}
                  onChange={s => {
                    const arr = [...form.original_supervisors]
                    arr[i] = s
                    set('original_supervisors', arr)
                  }}
                  onRemove={() => set('original_supervisors', form.original_supervisors.filter((_, j) => j !== i))}
                />
              ))}
              <button
                onClick={() => set('original_supervisors', [...form.original_supervisors, { name: '', reg_no: '', role: '' }])}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl text-sm font-medium transition-all hover:bg-blue-50"
              >
                + เพิ่มผู้ควบคุม
              </button>
            </div>
          )}
        </Section>

        {/* Supervisor Changes */}
        <Section title="การแจ้ง / เปลี่ยนผู้ควบคุมครั้งนี้">
          <SupervisorList changes={form.supervisor_changes} onChange={v => set('supervisor_changes', v)} />
        </Section>

        {/* EIA */}
        <Section title="EIA">
          <div className="flex gap-3">
            {(['none', 'approved'] as const).map(v => (
              <button
                key={v}
                onClick={() => set('eia_status', v)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                  ${form.eia_status === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
              >
                {v === 'none' ? 'ไม่มี EIA' : 'ได้รับความเห็นชอบแล้ว'}
              </button>
            ))}
          </div>
          {form.eia_status === 'approved' && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Field label="เลขหนังสือ EIA" value={form.eia_doc_no ?? ''} onChange={v => set('eia_doc_no', v)} />
              <Field label="วันที่" value={form.eia_doc_date ?? ''} onChange={v => set('eia_doc_date', v)} placeholder="วว/ดด/ปปปป" />
            </div>
          )}
        </Section>

        {/* Construction & Complaint */}
        <Section title="สภาพการก่อสร้าง / การร้องเรียน">
          <Field label="สภาพการก่อสร้าง" value={form.construction_status} onChange={v => set('construction_status', v)} placeholder="เช่น ก่อสร้างไปแล้วประมาณ 50%" highlight={isHighlight('construction_status')} />
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">การร้องเรียน</label>
            <div className="flex gap-3">
              {(['none', 'found'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => set('complaint', v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                    ${form.complaint === v
                      ? v === 'found' ? 'bg-red-600 border-red-600 text-white' : 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                >
                  {v === 'none' ? 'ไม่พบ' : 'พบการร้องเรียน'}
                </button>
              ))}
            </div>
          </div>
          {form.complaint === 'found' && (
            <Field label="รายละเอียดการร้องเรียน" value={form.complaint_detail ?? ''} onChange={v => set('complaint_detail', v)} />
          )}
        </Section>

        {/* Bottom Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl text-sm font-bold transition-all shadow-lg
            ${saving ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'}`}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกและสร้างเอกสาร'}
        </button>
      </main>
    </div>
  )
}
