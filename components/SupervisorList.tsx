'use client'

import type { SupervisorChange, Supervisor } from '@/types'

interface SupervisorListProps {
  changes: SupervisorChange[]
  onChange: (changes: SupervisorChange[]) => void
}

const EMPTY_SUPERVISOR: Supervisor = { name: '', reg_no: '', role: '' }

const EMPTY_CHANGE: SupervisorChange = {
  action: 'new',
  notice_receipt_no: '',
  notice_date: '',
  effective_date: '',
  form_type: 'น.3+น.4',
  new_supervisors: [{ ...EMPTY_SUPERVISOR }],
}

function SupervisorFields({
  sup,
  label,
  onChange,
}: {
  sup: Supervisor
  label: string
  onChange: (s: Supervisor) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล"
          value={sup.name}
          onChange={e => onChange({ ...sup, name: e.target.value })}
          className="col-span-3 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
        <input
          type="text"
          placeholder="เลขทะเบียน"
          value={sup.reg_no}
          onChange={e => onChange({ ...sup, reg_no: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
        <input
          type="text"
          placeholder="บทบาท/วิชาชีพ"
          value={sup.role}
          onChange={e => onChange({ ...sup, role: e.target.value })}
          className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
      </div>
    </div>
  )
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        placeholder="วว/ดด/ปปปป"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
    </div>
  )
}

export default function SupervisorList({ changes, onChange }: SupervisorListProps) {
  const update = (index: number, partial: Partial<SupervisorChange>) => {
    onChange(changes.map((c, i) => i === index ? { ...c, ...partial } : c))
  }

  const remove = (index: number) => {
    onChange(changes.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...changes, { ...EMPTY_CHANGE, new_supervisors: [{ ...EMPTY_SUPERVISOR }] }])
  }

  return (
    <div className="space-y-4">
      {changes.map((change, idx) => (
        <div key={idx} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-blue-200 transition-colors">
          {/* Row Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </div>
              {/* Action toggle */}
              <div className="flex rounded-lg overflow-hidden border border-slate-300">
                <button
                  onClick={() => update(idx, { action: 'new', from_supervisor: undefined, to_supervisor: undefined, new_supervisors: [{ ...EMPTY_SUPERVISOR }] })}
                  className={`px-3 py-1 text-xs font-semibold transition-colors
                    ${change.action === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  แจ้งชื่อใหม่
                </button>
                <button
                  onClick={() => update(idx, { action: 'change', new_supervisors: undefined, from_supervisor: { ...EMPTY_SUPERVISOR }, to_supervisor: { ...EMPTY_SUPERVISOR } })}
                  className={`px-3 py-1 text-xs font-semibold transition-colors
                    ${change.action === 'change' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                >
                  เปลี่ยนตัว
                </button>
              </div>
            </div>
            <button
              onClick={() => remove(idx)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors text-lg font-light"
              title="ลบรายการนี้"
            >
              ×
            </button>
          </div>

          {/* Row Body */}
          <div className="p-4 space-y-4">
            {/* Notice info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">เลขรับ</label>
                <input
                  type="text"
                  placeholder="ท.xxxx"
                  value={change.notice_receipt_no}
                  onChange={e => update(idx, { notice_receipt_no: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">แบบฟอร์ม</label>
                <select
                  value={change.form_type}
                  onChange={e => update(idx, { form_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  <option value="น.3+น.4">น.3+น.4</option>
                  <option value="น.4+น.5+น.7">น.4+น.5+น.7</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateInput label="วันที่แจ้ง" value={change.notice_date} onChange={v => update(idx, { notice_date: v })} />
              <DateInput label="วันที่มีผล" value={change.effective_date} onChange={v => update(idx, { effective_date: v })} />
            </div>

            {/* Supervisor fields */}
            {change.action === 'new' && (
              <div className="space-y-3">
                {(change.new_supervisors ?? []).map((sup, si) => (
                  <div key={si} className="bg-blue-50 rounded-xl p-3 relative">
                    <SupervisorFields
                      sup={sup}
                      label={`ผู้ควบคุมใหม่ ${(change.new_supervisors?.length ?? 0) > 1 ? `#${si + 1}` : ''}`}
                      onChange={s => {
                        const sups = [...(change.new_supervisors ?? [])]
                        sups[si] = s
                        update(idx, { new_supervisors: sups })
                      }}
                    />
                    {(change.new_supervisors?.length ?? 0) > 1 && (
                      <button
                        onClick={() => {
                          const sups = (change.new_supervisors ?? []).filter((_, i) => i !== si)
                          update(idx, { new_supervisors: sups })
                        }}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-400 text-sm"
                      >×</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => update(idx, { new_supervisors: [...(change.new_supervisors ?? []), { ...EMPTY_SUPERVISOR }] })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <span>+</span> เพิ่มผู้ควบคุมอีกคน
                </button>
              </div>
            )}

            {change.action === 'change' && (
              <div className="space-y-3">
                <div className="bg-orange-50 rounded-xl p-3">
                  <SupervisorFields
                    sup={change.from_supervisor ?? { ...EMPTY_SUPERVISOR }}
                    label="ผู้ควบคุมเดิม"
                    onChange={s => update(idx, { from_supervisor: s })}
                  />
                </div>
                <div className="flex items-center justify-center text-slate-400 text-lg">↓</div>
                <div className="bg-green-50 rounded-xl p-3">
                  <SupervisorFields
                    sup={change.to_supervisor ?? { ...EMPTY_SUPERVISOR }}
                    label="ผู้ควบคุมใหม่"
                    onChange={s => update(idx, { to_supervisor: s })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add button */}
      <button
        onClick={add}
        className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-2xl text-sm font-medium transition-all hover:bg-blue-50 flex items-center justify-center gap-2"
      >
        <span className="text-lg">+</span> เพิ่มผู้ควบคุมงาน
      </button>
    </div>
  )
}
