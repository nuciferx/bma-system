// lib/agent/orchestrator.ts
// ============================================================
// Orchestrator — ควบคุม flow ทั้งหมด
//
// Flow (simplified):
//   1. รับ OcrRequest (images + mode)
//   2. Gemini Vision อ่านภาพ → สกัด FormData + case_type โดยตรง
//   3. คืน OcrResponse
// ============================================================

import { geminiOcr } from './gemini-ocr'
import type { OcrRequest, OcrResponse } from '@/types'

const THB_PER_USD = 35

export async function orchestrate(req: OcrRequest): Promise<OcrResponse> {
  const startMs = Date.now()

  try {
    // mode C: parallel — เรื่องเก่า + ครั้งนี้
    const [newResult, oldResult] = await Promise.all([
      geminiOcr(req.new_doc_images, 'new'),
      req.mode === 'C' && req.old_doc_images?.length
        ? geminiOcr(req.old_doc_images, 'old')
        : Promise.resolve(null),
    ])

    if (!newResult.form_data || Object.keys(newResult.form_data).length === 0) {
      return errorResponse('Gemini ไม่สามารถสกัดข้อมูลจากภาพได้')
    }

    // mode C: merge ข้อมูลจากเรื่องเก่า (เติมเฉพาะ field ที่ยังว่าง)
    let formData = { ...newResult.form_data }
    if (oldResult) {
      const oldForm = oldResult.form_data
      for (const key of Object.keys(oldForm) as (keyof typeof oldForm)[]) {
        if (!formData[key] && oldForm[key]) {
          // @ts-ignore — dynamic merge
          formData[key] = oldForm[key]
        }
      }
    }

    const totalInputTokens  = newResult.input_tokens  + (oldResult?.input_tokens  ?? 0)
    const totalOutputTokens = newResult.output_tokens + (oldResult?.output_tokens ?? 0)
    const totalCostUsd      = newResult.cost_usd      + (oldResult?.cost_usd      ?? 0)

    console.log(
      `[orchestrator] done in ${Date.now() - startMs}ms`,
      `case_type=${newResult.case_type}`,
      `confidence=${newResult.detection_confidence}%`,
      `cost=$${totalCostUsd.toFixed(5)}`
    )

    return {
      success: true,
      case_type:             newResult.case_type,
      detection_confidence:  newResult.detection_confidence,
      detection_note:        newResult.detection_note,
      form_data:             formData,
      missing_fields:        newResult.missing_fields,
      low_confidence_fields: newResult.low_confidence_fields,
      confidence:            newResult.confidence,
      model:                 newResult.model,
      token_usage: {
        gemini_input:  totalInputTokens,
        gemini_output: totalOutputTokens,
        extract_input:  0,
        extract_output: 0,
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
      gemini_input:  0,
      gemini_output: 0,
      extract_input:  0,
      extract_output: 0,
      cost_usd: 0,
      cost_thb: 0,
    },
    error,
  }
}
