// app/api/model/route.ts
// GET /api/model — คืนชื่อ Gemini model ที่ดีที่สุดที่ใช้อยู่

import { NextResponse } from 'next/server'
import { selectBestModel } from '@/lib/agent/gemini-ocr'

export const revalidate = 3600 // cache 1 ชั่วโมง

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ model: 'unknown' })
  }
  try {
    const model = await selectBestModel(apiKey)
    return NextResponse.json({ model })
  } catch {
    return NextResponse.json({ model: 'unknown' })
  }
}
