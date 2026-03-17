// app/api/ocr/route.ts
// POST /api/ocr — รับ images จาก frontend → orchestrator → OcrResponse

export const maxDuration = 60 // Vercel: extend serverless timeout to 60s

import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '@/lib/agent/orchestrator'
import type { OcrRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OcrRequest

    if (!body.new_doc_images?.length) {
      return NextResponse.json(
        { success: false, error: 'กรุณาส่งภาพเอกสาร (new_doc_images)' },
        { status: 400 }
      )
    }

    if (!['A', 'B', 'C'].includes(body.mode)) {
      return NextResponse.json(
        { success: false, error: 'mode ต้องเป็น A, B หรือ C' },
        { status: 400 }
      )
    }

    if (body.mode === 'B' && !body.previous_case_id) {
      return NextResponse.json(
        { success: false, error: 'mode B ต้องระบุ previous_case_id' },
        { status: 400 }
      )
    }

    if (body.mode === 'C' && !body.old_doc_images?.length) {
      return NextResponse.json(
        { success: false, error: 'mode C ต้องส่งภาพเรื่องเก่า (old_doc_images)' },
        { status: 400 }
      )
    }

    const result = await orchestrate(body)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/ocr]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
