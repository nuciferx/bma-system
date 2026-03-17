// lib/agent/orchestrator.ts
// ============================================================
// Orchestrator — ควบคุม flow ทั้งหมด
//
// Flow:
//   1. รับ OcrRequest (images + mode)
//   2. Gemini อ่านภาพ → raw text
//   3. ดึง DB history ถ้า mode B
//   4. Haiku แปลง text → FormData + detect type
//   5. ถ้า confidence ต่ำ → retry
//   6. คืน OcrResponse
// ============================================================

import { geminiOcr } from './gemini-ocr'
import { extractForm } from './extract-form'
import { getActionHistory } from '@/lib/db/actions'
import type { OcrRequest, OcrResponse, SupervisorHistoryRecord } from '@/types'

const THB_PER_USD = 35
const CONFIDENCE_THRESHOLD = 65

export async function orchestrate(req: OcrRequest): Promise<OcrResponse> {
  const startMs = Date.now()

  try {
    // ── Step 1: OCR ภาพด้วย Gemini ───────────────────────────
    // mode C: parallel — เรื่องเก่า + ครั้งนี้
    const [newOcr, oldOcr] = await Promise.all([
      geminiOcr(req.new_doc_images, 'new'),
      req.mode === 'C' && req.old_doc_images?.length
        ? geminiOcr(req.old_doc_images, 'old')
        : Promise.resolve(null),
    ])

    if (!newOcr.raw_text.trim()) {
      return errorResponse('Gemini ไม่สามารถอ่านข้อความจากภาพได้')
    }

    // ── Step 2: ดึงประวัติจาก DB (mode B เท่านั้น) ───────────
    let dbHistory: SupervisorHistoryRecord[] = []
    if (req.mode === 'B' && req.previous_case_id) {
      dbHistory = await getActionHistory(req.previous_case_id)
    }

    // ── Step 3: Haiku แปลง text → FormData ───────────────────
    const extracted = await extractForm(newOcr, dbHistory, oldOcr ?? undefined)

    // ── Step 4: retry ถ้า confidence ต่ำ ─────────────────────
    let finalExtracted = extracted
    if (extracted.detection_confidence < CONFIDENCE_THRESHOLD) {
      console.log(
        `[orchestrator] confidence ต่ำ (${extracted.detection_confidence}%) → retry`
      )
      const retried = await extractForm(
        {
          ...newOcr,
          raw_text:
            newOcr.raw_text +
            '\n\n[RETRY: ตรวจสอบอีกครั้ง เน้นดูแบบฟอร์มที่ระบุ ตรวจหา น.3 น.5 ยผ.4]',
        },
        dbHistory,
        oldOcr ?? undefined
      )
      if (retried.detection_confidence > extracted.detection_confidence) {
        finalExtracted = {
          ...retried,
          input_tokens: extracted.input_tokens + retried.input_tokens,
          output_tokens: extracted.output_tokens + retried.output_tokens,
        }
      }
    }

    // ── Step 5: คำนวณ cost รวม ────────────────────────────────
    const geminiCostUsd = newOcr.cost_usd + (oldOcr?.cost_usd ?? 0)
    const claudeInputTokens = finalExtracted.input_tokens
    const claudeOutputTokens = finalExtracted.output_tokens
    // Haiku 4.5 pricing: $0.80/1M input, $4.00/1M output
    const claudeCostUsd =
      (claudeInputTokens / 1_000_000) * 0.8 +
      (claudeOutputTokens / 1_000_000) * 4.0
    const totalCostUsd = geminiCostUsd + claudeCostUsd

    console.log(
      `[orchestrator] done in ${Date.now() - startMs}ms`,
      `type=${finalExtracted.case_type}`,
      `confidence=${finalExtracted.detection_confidence}%`,
      `cost=$${totalCostUsd.toFixed(5)}`
    )

    return {
      success: true,
      case_type: finalExtracted.case_type,
      detection_confidence: finalExtracted.detection_confidence,
      detection_note: finalExtracted.detection_note,
      form_data: finalExtracted.form_data,
      missing_fields: finalExtracted.missing_fields,
      low_confidence_fields: finalExtracted.low_confidence_fields,
      token_usage: {
        gemini_input: newOcr.input_tokens + (oldOcr?.input_tokens ?? 0),
        gemini_output: newOcr.output_tokens + (oldOcr?.output_tokens ?? 0),
        claude_input: claudeInputTokens,
        claude_output: claudeOutputTokens,
        cost_usd: totalCostUsd,
        cost_thb: totalCostUsd * THB_PER_USD,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[orchestrator] error:', msg)
    return errorResponse(msg)
  }
}

function errorResponse(error: string): OcrResponse {
  return {
    success: false,
    case_type: 'unknown',
    detection_confidence: 0,
    detection_note: '',
    form_data: {},
    missing_fields: [],
    low_confidence_fields: [],
    token_usage: {
      gemini_input: 0,
      gemini_output: 0,
      claude_input: 0,
      claude_output: 0,
      cost_usd: 0,
      cost_thb: 0,
    },
    error,
  }
}
