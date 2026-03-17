// lib/agent/gemini-ocr.ts
// ============================================================
// Gemini Vision — อ่านภาพและสกัด FormData ตรงในครั้งเดียว
// ไม่มี 2-step OCR อีกต่อไป — ตรง image → JSON
// ============================================================

import type { CaseType, FormData } from '@/types'

// ─── Model ────────────────────────────────────────────────────
const MODEL = 'gemini-2.5-flash'
const PRICING = { input: 0.30, output: 2.50 } // per 1M tokens (USD)

// ยังคง export ไว้เพื่อ /api/model route
export async function selectBestModel(_apiKey: string): Promise<string> {
  return MODEL
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
จากภาพที่ให้มา สกัดข้อมูลและตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น ห้ามมี markdown ห้ามมี code block:
case_type: เห็น"ยผ.4"→D/E/F, เห็น"น.3"→B/BC, เห็น"น.5"/"น.7"→C/BC, ไม่เห็นน.x→A หรือ D
{
  "case_type": "A หรือ B หรือ C หรือ BC หรือ D หรือ E หรือ F",
  "detection_note": "",
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
  "original_supervisors": [{"name": "", "reg_no": "", "role": "", "is_new": false}],
  "orig_sup_status": "have หรือ none",
  "supervisor_changes": [],
  "eia_status": "none หรือ approved",
  "eia_doc_no": "",
  "eia_doc_date": "",
  "traffic_status": "none หรือ approved",
  "traffic_doc_no": "",
  "traffic_doc_date": "",
  "construction_status": "",
  "complaint": "none หรือ found",
  "complaint_detail": "",
  "ypo4_ack_date": "",
  "confidence": {"overall": 85, "low_fields": []}
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

  const model = MODEL
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const pricing = PRICING

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
      maxOutputTokens: 16384,
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
