// app/api/model/route.ts
// GET /api/model — คืนชื่อ Gemini model ที่ดีที่สุดที่ใช้อยู่

import { NextResponse } from 'next/server'

export const revalidate = 3600 // cache 1 ชั่วโมง

export async function GET() {
  return NextResponse.json({ model: 'gemini-3-flash-preview' })
}
