// lib/agent/gemini-ocr.ts
// ============================================================
// Gemini Vision — อ่านภาพและสกัด FormData ตรงในครั้งเดียว
// ไม่มี 2-step OCR อีกต่อไป — ตรง image → JSON
// ============================================================

import type { CaseType, FormData } from '@/types'

// ─── Model Selection ──────────────────────────────────────────
// ลำดับความสำคัญสำหรับ OCR: flash > pro (เร็ว + แม่น, ไม่ต้องการ reasoning ลึก)
const MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]

// Pricing per 1M tokens (USD) — fallback ถ้าไม่รู้ model
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro':   { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50  },
  'gemini-2.0-flash': { input: 0.10, output: 0.40  },
  'gemini-1.5-pro':   { input: 1.25, output: 5.00  },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
}

let _cachedModel: string | null = null
let _cacheTime = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 ชั่วโมง

export async function selectBestModel(apiKey: string): Promise<string> {
  const now = Date.now()
  if (_cachedModel && now - _cacheTime < CACHE_TTL) return _cachedModel

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (res.ok) {
      const data = await res.json() as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
      }
      const available = (data.models ?? [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))

      for (const priority of MODEL_PRIORITY) {
        // exact match ก่อน แล้วค่อย prefix match (เช่น gemini-2.5-flash-preview-xxx)
        const match =
          available.find(m => m === priority) ??
          available.find(m => m.startsWith(priority))
        if (match) {
          _cachedModel = match
          _cacheTime = now
          console.log(`[gemini] selected model: ${match}`)
          return match
        }
      }
    }
  } catch (e) {
    console.warn('[gemini] model list fetch failed, using fallback:', e)
  }

  _cachedModel = 'gemini-2.0-flash'
  _cacheTime = now
  return _cachedModel
}

function getPricing(model: string) {
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key)) return price
  }
  return { input: 0.30, output: 2.50 } // default
}

export interface GeminiExtractResult {
  case_type: CaseType
  detection_confidence: number
  detection_note: string
  form_data: Partial<FormData>
  missing_fields: string[]
  low_confidence_fields: string[]
  confidence: { overall: number; low_fields: string[] }
  pages_read: number
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

const EXTRACT_PROMPT = `คุณคือผู้เชี่ยวชาญอ่านเอกสารราชการไทย กองควบคุมอาคาร กทม.
จากภาพที่ให้มา สกัดข้อมูลทุก field ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น ห้ามมี markdown ห้ามมี code block

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
- ห้ามเดาข้อมูลที่อ่านไม่เจอ ใส่ "" แทน แล้วใส่ชื่อ field นั้นใน missing_fields
- วันที่คืนเป็น "DD/MM/YYYY" (พ.ศ.) หรือ "D เดือน YYYY" ตามที่อ่านได้
- ค่าธรรมเนียม: ตัวเลขล้วน ไม่มีหน่วย
- permit_form: "อ.1" หรือ "ยผ.4" เท่านั้น
- orig_sup_status: "have" ถ้ามีผู้ควบคุมงานอยู่, "none" ถ้าไม่มี

JSON ที่ต้องคืน:
{
  "case_type": "A|B|C|BC|D|E|F|unknown",
  "detection_note": "อธิบายสั้นๆ ว่าเห็นอะไร",
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
  "orig_sup_status": "have",
  "supervisor_changes": [],
  "supervisor_history": [],
  "eia_status": "none",
  "eia_doc_no": "",
  "eia_doc_date": "",
  "traffic_status": "none",
  "traffic_doc_no": "",
  "traffic_doc_date": "",
  "construction_status": "",
  "complaint": "none",
  "complaint_detail": "",
  "ypo4_ack_date": "",
  "prev_extend_history": [],
  "confidence": { "overall": 85, "low_fields": [] }
}`

// detect mime type จาก data URL prefix
function detectMimeType(b64: string): string {
  if (b64.startsWith('data:image/png'))  return 'image/png'
  if (b64.startsWith('data:image/webp')) return 'image/webp'
  if (b64.startsWith('data:image/gif'))  return 'image/gif'
  return 'image/jpeg' // default
}

export async function geminiOcr(
  base64Images: string[],
  label: 'new' | 'old' = 'new'
): Promise<GeminiExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const model = await selectBestModel(apiKey)
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const pricing = getPricing(model)

  const imageParts = base64Images.map((b64) => {
    const mimeType = detectMimeType(b64)
    const data = b64.replace(/^data:image\/\w+;base64,/, '')
    return { inline_data: { mime_type: mimeType, data } }
  })

  const payload = {
    contents: [
      {
        parts: [
          { text: EXTRACT_PROMPT },
          ...imageParts,
          {
            text: base64Images.length > 1
              ? `อ่านภาพทั้ง ${base64Images.length} หน้าและสกัดข้อมูลให้ครบ`
              : 'สกัดข้อมูลจากภาพนี้',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  }

  const res = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const json = await res.json() as {
    error?: { message: string }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  }

  if (json.error) throw new Error(json.error.message)

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!raw) throw new Error('Gemini returned empty response')

  // strip markdown fences if present
  const clean = raw
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/\s*```$/g, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>
  } catch {
    const start = clean.indexOf('{')
    const end   = clean.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('Gemini did not return valid JSON: ' + clean.slice(0, 200))
    }
    parsed = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
  }

  const usage = json.usageMetadata ?? {}
  const outputTokens = usage.candidatesTokenCount ?? 0
  const totalTokens  = usage.totalTokenCount ?? 0
  const inputTokens  = totalTokens > 0
    ? totalTokens - outputTokens
    : (usage.promptTokenCount ?? 0)
  const cost_usd =
    (inputTokens  / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output

  console.log(
    `[gemini-ocr] model=${model} label=${label} pages=${base64Images.length}`,
    `in=${inputTokens} out=${outputTokens}`,
    `cost=$${cost_usd.toFixed(5)}`,
    `case_type=${parsed.case_type ?? '?'}`,
    `permit_no="${parsed.permit_no ?? ''}"`,
    `owner_name="${parsed.owner_name ?? ''}"`
  )

  // สร้าง form_data จาก parsed (ยกเว้น meta fields)
  const {
    case_type, detection_note, confidence,
    ...formFields
  } = parsed

  const confidenceObj = (confidence as { overall: number; low_fields: string[] } | undefined)
    ?? { overall: 0, low_fields: [] }

  const allFields = Object.keys(formFields)
  const missing_fields = allFields.filter(
    (k) => formFields[k] === '' || formFields[k] === null || formFields[k] === undefined
  )

  return {
    case_type:             (case_type as CaseType) ?? 'unknown',
    detection_confidence:  confidenceObj.overall,
    detection_note:        (detection_note as string) ?? '',
    form_data:             formFields as Partial<FormData>,
    missing_fields,
    low_confidence_fields: confidenceObj.low_fields ?? [],
    confidence:            confidenceObj,
    pages_read:            base64Images.length,
    model,
    input_tokens:          inputTokens,
    output_tokens:         outputTokens,
    cost_usd,
  }
}
