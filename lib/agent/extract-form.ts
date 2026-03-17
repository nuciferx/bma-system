// lib/agent/extract-form.ts
// ============================================================
// Extract Form Tool
// รับ raw text จาก Gemini → แปลงเป็น FormData + detect CaseType
// ใช้ Claude Haiku
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { CaseType, FormData, GeminiOcrResult, SupervisorHistoryRecord } from '@/types'

const client = new Anthropic()

export interface ExtractResult {
  case_type: CaseType
  detection_confidence: number
  detection_note: string
  form_data: Partial<FormData>
  missing_fields: string[]
  low_confidence_fields: string[]
  input_tokens: number
  output_tokens: number
}

function buildPrompt(
  ocrText: string,
  dbHistory: SupervisorHistoryRecord[],
  oldDocText?: string
): string {
  const historySection =
    dbHistory.length > 0
      ? `\n\n=== ประวัติจากฐานข้อมูล (ครั้งก่อนๆ) ===\n${JSON.stringify(dbHistory, null, 2)}`
      : ''

  const oldDocSection = oldDocText
    ? `\n\n=== ข้อความจากบันทึกเก่า (สแกนมา) ===\n${oldDocText}`
    : ''

  return `คุณคือผู้เชี่ยวชาญวิเคราะห์เอกสารราชการไทย กองควบคุมอาคาร กทม.

งานของคุณ:
1. ระบุ case_type จากตารางด้านล่าง
2. สกัดข้อมูลทุก field ที่ทำได้
3. คืนเป็น JSON เท่านั้น ห้ามมีข้อความอื่น ห้าม markdown ห้าม code block

ตาราง case_type:
- A  = ต่ออายุ อ.1 ไม่มีการแจ้งผู้ควบคุม
- B  = ต่ออายุ อ.1 + แจ้งชื่อผู้ควบคุมครั้งแรก (มีแบบ น.3+น.4)
- C  = ต่ออายุ อ.1 + เปลี่ยนผู้ควบคุม (มีแบบ น.4+น.5+น.7)
- BC = ต่ออายุ อ.1 + ทั้งแจ้งและเปลี่ยน (มีทั้ง น.3 และ น.5)
- D  = ต่ออายุ ยผ.4 ไม่มีการแจ้งผู้ควบคุม
- E  = ต่ออายุ ยผ.4 + แจ้งชื่อ
- F  = ต่ออายุ ยผ.4 + เปลี่ยนผู้ควบคุม

ตัวบ่งชี้ case_type:
- เห็น "ยผ.4" → D/E/F
- เห็น "น.3" → มีแจ้งชื่อใหม่
- เห็น "น.5" หรือ "น.7" → มีเปลี่ยนผู้ควบคุม
- ไม่เห็น น.x เลย → ไม่มีการแจ้ง

กฎสำคัญ:
- ห้ามเดาข้อมูลที่อ่านไม่เจอ ใส่ "" แทน แล้วใส่ใน missing_fields
- วันที่คืนเป็น "DD/MM/YYYY" (พ.ศ.)
- ค่าธรรมเนียม: ตัวเลขล้วน ไม่มีหน่วย

รูปแบบ JSON ที่ต้องคืน:
{
  "case_type": "A|B|C|BC|D|E|F|unknown",
  "detection_confidence": 0-100,
  "detection_note": "อธิบายสั้นๆ",
  "form_data": {
    "doc_date": "",
    "officer_name": "",
    "officer_position": "",
    "owner_name": "",
    "owner_rep": "",
    "permit_no": "",
    "permit_form": "อ.1 หรือ ยผ.4",
    "permit_date": "",
    "permit_expire": "",
    "building_desc": "",
    "location_soi": "",
    "location_road": "",
    "location_subdistrict": "",
    "location_district": "",
    "receipt_no": "",
    "receipt_date": "",
    "renew_count": "",
    "renew_from": "",
    "renew_to": "",
    "fee": "",
    "original_supervisors": [{"name":"","reg_no":"","role":""}],
    "orig_sup_status": "have หรือ none",
    "supervisor_changes": [],
    "supervisor_history": [],
    "eia_status": "none หรือ approved",
    "eia_doc_no": "",
    "eia_doc_date": "",
    "construction_status": "",
    "complaint": "none หรือ found",
    "complaint_detail": "",
    "ypo4_ack_date": "",
    "prev_extend_history": []
  },
  "missing_fields": [],
  "low_confidence_fields": []
}

=== ข้อความจากเอกสาร (OCR) ===
${ocrText}${historySection}${oldDocSection}`
}

export async function extractForm(
  newDocOcr: GeminiOcrResult,
  dbHistory: SupervisorHistoryRecord[] = [],
  oldDocOcr?: GeminiOcrResult
): Promise<ExtractResult> {
  const prompt = buildPrompt(
    newDocOcr.raw_text,
    dbHistory,
    oldDocOcr?.raw_text
  )

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // clean markdown fences ถ้า Haiku ใส่มา
  const clean = raw
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/\s*```$/g, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>
  } catch {
    // หา JSON ที่ซ่อนอยู่
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('extractForm: Haiku ไม่คืน JSON: ' + clean.slice(0, 200))
    }
    parsed = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
  }

  const usage = response.usage

  return {
    case_type: (parsed.case_type as CaseType) ?? 'unknown',
    detection_confidence: (parsed.detection_confidence as number) ?? 0,
    detection_note: (parsed.detection_note as string) ?? '',
    form_data: (parsed.form_data as Partial<FormData>) ?? {},
    missing_fields: (parsed.missing_fields as string[]) ?? [],
    low_confidence_fields: (parsed.low_confidence_fields as string[]) ?? [],
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  }
}
