// lib/agent/gemini-ocr.ts
// ============================================================
// Gemini OCR Tool — อ่านภาพ คืน raw text เท่านั้น
// ไม่วิเคราะห์ ไม่ตีความ ไม่ detect type
// ============================================================

import type { GeminiOcrResult } from '@/types'

// gemini-2.0-flash เป็น stable ล่าสุดที่รองรับ multimodal (ปรับตาม pricing จริง)
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// input $0.10/1M tokens, output $0.40/1M tokens (flash pricing)
const COST_INPUT_PER_1M = 0.10
const COST_OUTPUT_PER_1M = 0.40

const OCR_PROMPT = `อ่านข้อความในภาพนี้ทั้งหมดตามที่เห็น
คัดลอกข้อความออกมาให้ครบถ้วน ตามลำดับจากบนลงล่าง
ห้ามสรุป ห้ามตีความ ห้ามละเว้นข้อความใด
รวมถึงเลขที่ วันที่ ชื่อ ทะเบียน และตัวเลขทุกตัว`

export async function geminiOcr(
  base64Images: string[],
  label: 'new' | 'old' = 'new'
): Promise<GeminiOcrResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const imageParts = base64Images.map((b64) => {
    // strip data URL prefix ถ้ามี
    const data = b64.replace(/^data:image\/\w+;base64,/, '')
    return { inline_data: { mime_type: 'image/jpeg', data } }
  })

  const payload = {
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          ...imageParts,
          {
            text:
              base64Images.length > 1
                ? `อ่านภาพทั้ง ${base64Images.length} หน้า ตามลำดับ คั่นแต่ละหน้าด้วย "=== หน้า N ==="`
                : 'อ่านภาพนี้',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
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
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }

  if (json.error) throw new Error(json.error.message)

  const raw_text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!raw_text) throw new Error('Gemini returned empty text')

  const usage = json.usageMetadata ?? {}
  const input_tokens = usage.promptTokenCount ?? 0
  const output_tokens = usage.candidatesTokenCount ?? 0
  const cost_usd =
    (input_tokens / 1_000_000) * COST_INPUT_PER_1M +
    (output_tokens / 1_000_000) * COST_OUTPUT_PER_1M

  console.log(
    `[gemini-ocr] label=${label} pages=${base64Images.length}`,
    `in=${input_tokens} out=${output_tokens}`,
    `cost=$${cost_usd.toFixed(5)}`
  )

  return {
    raw_text,
    pages_read: base64Images.length,
    model: GEMINI_MODEL,
    input_tokens,
    output_tokens,
    cost_usd,
  }
}
