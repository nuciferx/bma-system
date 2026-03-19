// app/api/cases/route.ts
// GET  /api/cases?q=xxx — search + list
// POST /api/cases       — save case + generate doc

import { NextRequest, NextResponse } from 'next/server'
import { searchBuildings, saveCase, getRecentBuildings } from '@/lib/db/actions'
import { generateDoc } from '@/lib/docx/generator'
import { createClient } from '@supabase/supabase-js'
import type { Building, Action, FormData, CaseType } from '@/types'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── GET /api/cases ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const limitStr = searchParams.get('limit') ?? '20'
    const limit = Math.min(parseInt(limitStr, 10) || 20, 100)

    const buildings = q
      ? await searchBuildings(q)
      : await getRecentBuildings(limit)

    // ── metrics (simple) ─────────────────────────────────────
    const supabase = getSupabase()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [monthRes] = await Promise.all([
      supabase
        .from('actions')
        .select('action_id, form_data_snapshot', { count: 'exact' })
        .gte('created_at', monthStart),
    ])

    const this_month_count = monthRes.count ?? 0

    // รวม AI cost จาก token_usage ที่เก็บใน form_data_snapshot (ถ้ามี)
    let ai_cost_thb = 0
    if (monthRes.data) {
      for (const row of monthRes.data) {
        const snap = row.form_data_snapshot as Record<string, unknown> | null
        const usage = snap?.token_usage as { cost_thb?: number } | undefined
        ai_cost_thb += usage?.cost_thb ?? 0
      }
    }

    // normalize cases สำหรับ dashboard
    const cases = (buildings as Array<Record<string, unknown>>).map((b) => {
      const actions = (b.actions as Array<Record<string, unknown>> | undefined) ?? []
      const latest = actions[0] ?? {}
      return {
        id: b.building_id,
        permit_no: b.permit_no,
        owner_name: b.owner_name,
        case_type: latest.case_type ?? 'unknown',
        receipt_date: latest.doc_date ?? '',
        renew_to: '',
        created_at: latest.created_at ?? b.created_at,
      }
    })

    return NextResponse.json({
      cases,
      metrics: {
        this_month_count,
        pending_count: 0,    // implement ทีหลัง
        ai_cost_thb,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// ─── POST /api/cases ─────────────────────────────────────────
// body: { formData, caseType, saveToDb, doc_images? }
export async function POST(req: NextRequest) {
  let body: { formData: FormData; caseType?: CaseType; saveToDb?: boolean; doc_images?: string[] }

  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { formData, caseType = 'A', saveToDb = true, doc_images } = body

  if (!formData) {
    return NextResponse.json({ error: 'formData is required' }, { status: 400 })
  }

  // Generate doc buffer
  let buffer: Buffer
  try {
    buffer = await generateDoc(formData, caseType)
  } catch (err) {
    return NextResponse.json(
      { error: `Document generation failed: ${String(err)}` },
      { status: 500 }
    )
  }

  const filename = buildFilename(formData)

  // Preview mode — ไม่ save DB
  if (!saveToDb) {
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

  // Upload to Supabase Storage (ASCII-only key)
  const supabase = getSupabase()
  const safeKey = filename.replace(/[^\x00-\x7F]/g, '').replace(/^_+|_+$/g, '') || 'doc'
  const storagePath = `docs/${Date.now()}_${safeKey}`
  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, {
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    })

  if (uploadErr) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadErr.message}` },
      { status: 500 }
    )
  }

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath)
  const doc_url = urlData.publicUrl

  // Upload doc images to Supabase Storage (ถ้ามี)
  const imageUrls: string[] = []
  if (doc_images && doc_images.length > 0) {
    const imagePrefix = `images/${Date.now()}`
    for (let i = 0; i < doc_images.length; i++) {
      const b64 = doc_images[i]
      const mimeMatch = b64.match(/^data:(image\/\w+);base64,/)
      const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
      const data = b64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(data, 'base64')
      const imgPath = `${imagePrefix}/page-${i + 1}.${ext}`
      const { error: imgErr } = await supabase.storage
        .from('documents')
        .upload(imgPath, buffer, { contentType: mimeType, upsert: false })
      if (!imgErr) {
        const { data: imgUrlData } = supabase.storage.from('documents').getPublicUrl(imgPath)
        imageUrls.push(imgUrlData.publicUrl)
      }
    }
  }

  // รวม image_urls เข้า formData ก่อน save
  const formDataWithImages: FormData = imageUrls.length > 0
    ? { ...formData, image_urls: imageUrls }
    : formData

  // Build building + action objects
  const building: Omit<Building, 'building_id' | 'created_at'> = {
    permit_no: formDataWithImages.permit_no,
    permit_form: formDataWithImages.permit_form,
    permit_date: formDataWithImages.permit_date,
    owner_name: formDataWithImages.owner_name,
    owner_rep: formDataWithImages.owner_rep,
    building_desc: formDataWithImages.building_desc,
    location_soi: formDataWithImages.location_soi,
    location_road: formDataWithImages.location_road,
    location_subdistrict: formDataWithImages.location_subdistrict,
    location_district: formDataWithImages.location_district,
    permit_expire: formDataWithImages.permit_expire,
    original_supervisors: formDataWithImages.original_supervisors,
  }

  const action: Omit<Action, 'action_id' | 'building_id' | 'created_at'> = {
    case_type: caseType,
    renew_count: formDataWithImages.renew_count,
    renew_from: formDataWithImages.renew_from,
    renew_to: formDataWithImages.renew_to,
    receipt_no: formDataWithImages.receipt_no,
    receipt_date: formDataWithImages.receipt_date,
    supervisors_snapshot: formDataWithImages.original_supervisors,
    supervisor_changes: formDataWithImages.supervisor_changes,
    supervisor_history: formDataWithImages.supervisor_history,
    ack_doc_no: '',
    ack_doc_date: '',
    fee: formDataWithImages.fee,
    eia_status: formDataWithImages.eia_status,
    eia_doc_no: formDataWithImages.eia_doc_no,
    eia_doc_date: formDataWithImages.eia_doc_date,
    construction_status: formDataWithImages.construction_status,
    complaint: formDataWithImages.complaint,
    complaint_detail: formDataWithImages.complaint_detail,
    form_data_snapshot: formDataWithImages,
    doc_url,
    doc_date: formDataWithImages.doc_date,
  }

  try {
    const result = await saveCase(building, action)
    return NextResponse.json({ doc_url, ...result }, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: `Database save failed: ${String(err)}` },
      { status: 500 }
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function buildFilename(formData: FormData): string {
  const ownerSlug = (formData.owner_name ?? 'ไม่ระบุ')
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0E00-\u0E7F]/g, '')

  const rawDate = formData.doc_date ?? ''
  let datePart = 'nodate'
  if (rawDate.includes('/')) {
    const [dd, mm, yyyy] = rawDate.split('/')
    datePart = `${yyyy}${mm?.padStart(2, '0')}${dd?.padStart(2, '0')}`
  } else if (rawDate.length >= 8) {
    datePart = rawDate.replace(/-/g, '').slice(0, 8)
  }

  return `บันทึก_${ownerSlug}_${datePart}.docx`
}
