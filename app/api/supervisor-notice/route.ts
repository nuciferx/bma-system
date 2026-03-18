// app/api/supervisor-notice/route.ts
// POST /api/supervisor-notice — สร้างบันทึกแจ้ง/เปลี่ยนผู้ควบคุมงาน

import { NextRequest, NextResponse } from 'next/server'
import { generateSupervisorNoticeDoc } from '@/lib/docx/supervisor-notice'
import type { FormData } from '@/types'

export async function POST(req: NextRequest) {
  let body: { formData: FormData }

  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { formData } = body
  if (!formData) {
    return NextResponse.json({ error: 'formData is required' }, { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = await generateSupervisorNoticeDoc(formData)
  } catch (err) {
    return NextResponse.json(
      { error: `Document generation failed: ${String(err)}` },
      { status: 500 }
    )
  }

  const ownerSlug = (formData.owner_name ?? 'ไม่ระบุ')
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0E00-\u0E7F]/g, '')

  const filename = `บันทึกแจ้งผู้ควบคุม_${ownerSlug}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    },
  })
}
