// ============================================================
// BMA System — Type Definitions
// source of truth — ทุกไฟล์ import จากที่นี่เท่านั้น
// ============================================================

// ─── Case Types ──────────────────────────────────────────────
export type CaseType = 'A' | 'B' | 'C' | 'BC' | 'D' | 'E' | 'F' | 'unknown'
export type PermitForm = 'อ.1' | 'ยผ.4'
export type SupervisorAction = 'none' | 'new' | 'change' | 'both'

// ─── Scan Modes ──────────────────────────────────────────────
// A = ครั้งแรก สแกนเอกสารชุดใหม่อย่างเดียว
// B = ครั้งที่ 2+ ดึง DB + สแกนชุดใหม่
// C = บรรจุใหม่ สแกนเรื่องเก่า + ชุดใหม่
export type ScanMode = 'A' | 'B' | 'C'

// ─── Gemini Raw OCR Output ───────────────────────────────────
export interface GeminiOcrResult {
  raw_text: string
  pages_read: number
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

// ─── Supervisor ───────────────────────────────────────────────
export interface Supervisor {
  name: string
  reg_no: string   // เช่น สย.14698, ส-สถ 2172
  role: string     // เช่น วิศวกรโครงสร้าง, สถาปนิก
}

export interface SupervisorChange {
  action: 'new' | 'change'
  notice_receipt_no: string
  notice_date: string
  effective_date: string
  form_type: string         // น.3+น.4 หรือ น.4+น.5+น.7
  new_supervisors?: Supervisor[]
  from_supervisor?: Supervisor
  to_supervisor?: Supervisor
}

// ─── Supervisor History ──────────────────────────────────────
export interface SupervisorHistoryRecord {
  receipt_no: string
  date: string
  action_detail: string
  ack_doc_no: string
  ack_doc_date: string
  ack_date: string
}

// ─── Form Data ───────────────────────────────────────────────
export interface FormData {
  // header
  doc_date: string
  officer_name: string
  officer_position: string

  // เจ้าของ
  owner_name: string
  owner_rep: string

  // ใบอนุญาต
  permit_no: string
  permit_form: PermitForm
  permit_date: string
  permit_expire: string
  building_desc: string

  // ที่ตั้ง
  location_soi: string
  location_road: string
  location_subdistrict: string
  location_district: string

  // คำขอครั้งนี้
  receipt_no: string
  receipt_date: string
  renew_count: string
  renew_from: string
  renew_to: string
  fee: string

  // ผู้ควบคุมงานตามใบอนุญาตเดิม
  original_supervisors: Supervisor[]
  orig_sup_status: 'have' | 'none'

  // การแจ้ง/เปลี่ยนผู้ควบคุมครั้งนี้
  supervisor_changes: SupervisorChange[]

  // ประวัติครั้งก่อน
  supervisor_history: SupervisorHistoryRecord[]

  // ยผ.4 เฉพาะ
  ypo4_ack_date?: string
  prev_extend_history?: Array<{ count: string; to_date: string }>

  // EIA
  eia_status: 'none' | 'approved'
  eia_doc_no?: string
  eia_doc_date?: string

  // จราจร (traffic)
  traffic_status: 'none' | 'approved'
  traffic_doc_no?: string
  traffic_doc_date?: string

  // ต่อได้กี่ปี (default "๑")
  extend_years?: string

  // การก่อสร้าง / ร้องเรียน
  construction_status: string
  complaint: 'none' | 'found'
  complaint_detail?: string
}

// ─── OCR Request / Response ──────────────────────────────────
export interface OcrRequest {
  new_doc_images: string[]      // base64 jpeg
  old_doc_images?: string[]     // mode C เท่านั้น
  mode: ScanMode
  previous_case_id?: string     // mode B
}

export interface OcrResponse {
  success: boolean
  case_type: CaseType
  detection_confidence: number
  detection_note: string
  form_data: Partial<FormData>
  missing_fields: string[]
  low_confidence_fields: string[]
  confidence?: { overall: number; low_fields: string[] }
  model?: string
  token_usage: {
    gemini_input: number
    gemini_output: number
    extract_input: number
    extract_output: number
    cost_usd: number
    cost_thb: number
  }
  error?: string
}

// ─── DB Models ────────────────────────────────────────────────
export interface Building {
  building_id: string
  permit_no: string
  permit_form: PermitForm
  permit_date: string
  owner_name: string
  owner_rep: string
  building_desc: string
  location_soi: string
  location_road: string
  location_subdistrict: string
  location_district: string
  permit_expire: string
  original_supervisors: Supervisor[]
  created_at: string
}

export interface Action {
  action_id: string
  building_id: string
  case_type: CaseType
  renew_count: string
  renew_from: string
  renew_to: string
  receipt_no: string
  receipt_date: string
  supervisors_snapshot: Supervisor[]
  supervisor_changes: SupervisorChange[]
  supervisor_history: SupervisorHistoryRecord[]
  ack_doc_no: string
  ack_doc_date: string
  fee: string
  eia_status: 'none' | 'approved'
  eia_doc_no?: string
  eia_doc_date?: string
  construction_status: string
  complaint: 'none' | 'found'
  complaint_detail?: string
  form_data_snapshot: FormData
  doc_url: string
  doc_date: string
  created_at: string
}

export interface Log {
  id: string
  user_id: string
  action: 'ocr' | 'save_case' | 'generate_doc' | 'search' | 'view_case'
  case_id?: string
  building_id?: string
  payload?: Record<string, unknown>
  created_at: string
}
