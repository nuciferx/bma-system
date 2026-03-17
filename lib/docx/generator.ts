// lib/docx/generator.ts
// ─── Docx Generator ───────────────────────────────────────────
// รับ FormData + CaseType → คืน Buffer (.docx)
// Document structure ตรงกับ GAS ต้นแบบ

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'
import type { FormData, CaseType, SupervisorChange } from '@/types'

const TEMPLATE_PATH = path.join(process.cwd(), 'lib', 'docx', 'template.docx')

// Thai ordinal numerals (๑-๑๒)
const THAI_NUM = ['', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙', '๑๐', '๑๑', '๑๒']
function thaiNumeral(n: number): string {
  return THAI_NUM[n] ?? String(n)
}

// ─── Helpers ──────────────────────────────────────────────────
function isYpo4(formData: FormData): boolean {
  return (formData.permit_form ?? '').includes('ยผ')
}

function hasNew(formData: FormData): boolean {
  return (formData.supervisor_changes ?? []).some((sc) => sc.action === 'new')
}

function hasChange(formData: FormData): boolean {
  return (formData.supervisor_changes ?? []).some((sc) => sc.action === 'change')
}

function locationStr(formData: FormData): string {
  return [
    formData.location_soi         ? 'ซอย' + formData.location_soi         : '',
    formData.location_road        ? 'ถนน' + formData.location_road        : '',
    formData.location_subdistrict ? 'แขวง' + formData.location_subdistrict : '',
    formData.location_district    ? 'เขต' + formData.location_district    : '',
    'กรุงเทพมหานคร',
  ].filter(Boolean).join(' ')
}

// ─── buildTitle ───────────────────────────────────────────────
function buildTitle(formData: FormData): string {
  const ypo4 = isYpo4(formData)
  const verb = ypo4 ? 'การขอขยายระยะเวลาใบรับแจ้ง' : 'การขออนุญาตต่ออายุใบอนุญาต'
  let suffix = ''
  if (hasNew(formData) && hasChange(formData)) suffix = ' และแจ้งผู้ควบคุมงาน'
  else if (hasNew(formData))                    suffix = ' และแจ้งชื่อผู้ควบคุมงาน'
  else if (hasChange(formData))                 suffix = ' และแจ้งเปลี่ยนชื่อผู้ควบคุมงาน'
  return verb + suffix + ' ราย ' + (formData.owner_name || '___')
}

// ─── buildOrigSupText ─────────────────────────────────────────
function buildOrigSupText(formData: FormData): string {
  if (formData.orig_sup_status === 'none') return 'โดยยังไม่ได้แจ้งผู้ควบคุมงาน'
  const sups = formData.original_supervisors ?? []
  if (!sups.length) return 'โดยยังไม่ได้แจ้งผู้ควบคุมงาน'
  const supsStr = sups
    .map((s) => `${s.name} หมายเลขทะเบียน ${s.reg_no} เป็น${s.role}`)
    .join(' และ')
  return 'โดยมี' + supsStr + 'เป็นผู้ควบคุมงาน'
}

// ─── buildIntro ───────────────────────────────────────────────
function buildIntro(formData: FormData): string {
  const ypo4 = isYpo4(formData)
  const verbReq   = ypo4 ? 'ขยายระยะเวลาใบรับแจ้ง' : 'ต่ออายุใบอนุญาต'
  const formLabel = ypo4 ? 'ยผ.4' : 'ข.๔'
  const permitLabel = formData.permit_form || (ypo4 ? 'ยผ.4' : 'อ.๑')

  let t =
    '\t' + (formData.owner_name || '___') +
    ' โดย ' + (formData.owner_rep || '___') +
    ' ได้ยื่นคำขอ' + verbReq +
    ' (แบบ ' + formLabel + ') เลขรับที่ ' + (formData.receipt_no || '___') +
    ' ลงวันที่ ' + (formData.receipt_date || '___') +
    ' ขอ' + verbReq +
    ' (แบบ ' + permitLabel + ')' +
    ' เลขที่ ' + (formData.permit_no || '___') +
    ' ลงวันที่ ' + (formData.permit_date || '___')

  const changes = formData.supervisor_changes ?? []
  const newSups = changes.filter((sc) => sc.action === 'new')
  const chgSups = changes.filter((sc) => sc.action === 'change')

  if (!newSups.length && !chgSups.length) return t

  t += ' และได้มีหนังสือแจ้งผู้ควบคุมดังนี้'

  let itemNo = 1

  // group new supervisors by notice_receipt_no
  const noticeGroups: Record<string, SupervisorChange[]> = {}
  newSups.forEach((sc) => {
    const key = sc.notice_receipt_no || '_'
    noticeGroups[key] = noticeGroups[key] ?? []
    noticeGroups[key].push(sc)
  })

  for (const key of Object.keys(noticeGroups)) {
    const group = noticeGroups[key]
    const s0 = group[0]
    t +=
      '\n\n' + itemNo++ + '. หนังสือเลขรับที่ ท.' + (s0.notice_receipt_no || '___') +
      ' ลงวันที่ ' + (s0.notice_date || '___') +
      ' (แบบ น.3 และ น.4) แจ้งชื่อผู้ควบคุมงาน โดยมีความประสงค์ให้'
    ;(s0.new_supervisors ?? []).forEach((s) => {
      t += '\n - ' + (s.name || '___') +
        ' หมายเลขทะเบียน ' + (s.reg_no || '___') +
        ' เป็น' + (s.role || 'ผู้ควบคุมงาน')
    })
    t += '\nตั้งแต่วันที่ ' + (s0.effective_date || '___') + ' เป็นต้นไป'
  }

  chgSups.forEach((sc) => {
    const from = sc.from_supervisor
    const to   = sc.to_supervisor
    t +=
      '\n\n' + itemNo++ + '. หนังสือเลขรับที่ ท.' + (sc.notice_receipt_no || '___') +
      ' ลงวันที่ ' + (sc.notice_date || '___') +
      ' (แบบ น.4 น.5 และ น.7) แจ้งเปลี่ยนชื่อผู้ควบคุมงาน' +
      ' โดยเปลี่ยน' + (from?.role || 'ผู้ควบคุมงาน') +
      ' จาก' + (from?.name || '___') + ' หมายเลขทะเบียน ' + (from?.reg_no || '___') +
      ' เป็น' + (to?.name || '___') + ' หมายเลขทะเบียน ' + (to?.reg_no || '___') +
      ' ตั้งแต่วันที่ ' + (sc.effective_date || '___') + ' เป็นต้นไป'
  })

  return t
}

// ─── buildFacts ───────────────────────────────────────────────
function buildFacts(formData: FormData): string[] {
  const ypo4    = isYpo4(formData)
  const history = formData.supervisor_history ?? []
  const loc     = locationStr(formData)
  const verbBuilding  = ypo4 ? 'ขยายระยะเวลาใบรับแจ้ง' : 'ต่ออายุใบอนุญาต'
  const verbPerson    = ypo4 ? 'ผู้แจ้ง' : 'ผู้ได้รับใบอนุญาต'
  const verbAction    = ypo4 ? 'ขยายระยะเวลาใบรับแจ้ง' : 'ต่ออายุใบอนุญาต'
  const permitLabel   = formData.permit_form || (ypo4 ? 'ยผ.4' : 'อ.๑')

  const facts: string[] = []
  let n = 1

  // ข้อ ๑ — อาคาร
  let fact1 =
    '\t' + thaiNumeral(n++) + '. อาคารที่ขอ' + verbBuilding + 'รายนี้' +
    ' ได้รับอนุญาตให้ก่อสร้าง/ดัดแปลงอาคาร' + (formData.building_desc || '___') +
    ' ที่' + loc +
    ' ตามใบอนุญาต (แบบ ' + permitLabel + ')' +
    ' เลขที่ ' + (formData.permit_no || '___') +
    ' ลงวันที่ ' + (formData.permit_date || '___') +
    ' สิ้นอายุวันที่ ' + (formData.permit_expire || '___') +
    ' ' + buildOrigSupText(formData)

  if (ypo4) {
    fact1 += ' ซึ่งผู้ว่าราชการกรุงเทพมหานครได้รับทราบแบบแปลนไม่ขัดข้องฯ แล้ว เมื่อวันที่ ' +
      (formData.ypo4_ack_date || '___')
    const prevExtend = formData.prev_extend_history ?? []
    if (prevExtend.length > 0) {
      fact1 += ' และ' + prevExtend.map((e) =>
        'ขยายระยะเวลาใบรับแจ้ง ครั้งที่ ' + e.count + ' ถึงวันที่ ' + e.to_date
      ).join(' ')
    }
  }
  facts.push(fact1)

  // ข้อ ๒+ — ประวัติ supervisor history (ที่รับทราบแล้ว)
  history.forEach((h) => {
    if (!h.receipt_no) return
    facts.push(
      '\t' + thaiNumeral(n++) + '. ' + (ypo4 ? 'ผู้แจ้งได้เคยยื่น' : 'ผู้ขออนุญาตเคยมีหนังสือ') +
      'เลขรับที่ ท.' + (h.receipt_no || '___') + ' ลงวันที่ ' + (h.date || '___') +
      ' ' + (h.action_detail || '') +
      ' ซึ่งผู้ว่าราชการกรุงเทพมหานครได้รับทราบแล้ว เมื่อวันที่ ' + (h.ack_date || '___') +
      ' ตามหนังสือ ที่ กท ' + (h.ack_doc_no || '___') + ' ลงวันที่ ' + (h.ack_doc_date || '___')
    )
  })

  // ข้อ — มาตรา 35
  facts.push(
    '\t' + thaiNumeral(n++) + '. ' + verbPerson + 'ได้ยื่นขอ' + verbAction +
    'มาก่อนที่ใบอนุญาตจะสิ้นอายุลง ถูกต้องตามมาตรา ๓๕ แห่งพระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒' +
    ' แก้ไขเพิ่มเติมโดยพระราชบัญญัติควบคุมอาคาร (ฉบับที่ ๒) พ.ศ. ๒๕๓๕' +
    ' และกฎกระทรวงกำหนดหลักเกณฑ์ วิธีการ และเงื่อนไขในการขออนุญาต การอนุญาต' +
    ' การต่ออายุใบอนุญาต การโอนใบอนุญาต การออกใบรับรอง และการออกใบแทน' +
    'ตามกฎหมายว่าด้วยการควบคุมอาคาร พ.ศ. ๒๕๖๔' +
    ' ซึ่งการขอ' + verbAction + 'ครั้งนี้ เป็นครั้งที่ ' + (formData.renew_count || '___') +
    ' (' + (ypo4 ? 'ขยายระยะเวลาฯ' : 'ต่ออายุฯ') + ' ได้อีกไม่เกิน ๓ ครั้ง)'
  )

  // ข้อ — EIA
  if (formData.eia_status === 'approved') {
    facts.push(
      '\t' + thaiNumeral(n++) + '. อาคารรายนี้ได้รับความเห็นชอบในรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม' +
      ' ตามประกาศกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม เรื่อง กำหนดประเภทและขนาดของโครงการหรือกิจการ' +
      'ซึ่งต้องจัดทำรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม และหลักเกณฑ์ วิธีการ ระเบียบปฏิบัติ' +
      ' และแนวทางการจัดทำรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อมแล้ว' +
      ' ตามหนังสือสำนักงานนโยบายและแผนทรัพยากรธรรมชาติและสิ่งแวดล้อม ที่ ทส ' +
      (formData.eia_doc_no || '___') + ' ลงวันที่ ' + (formData.eia_doc_date || '___')
    )
  } else {
    facts.push(
      '\t' + thaiNumeral(n++) + '. อาคารรายนี้ไม่เข้าข่ายต้องจัดทำรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม' +
      ' ตามประกาศกระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม เรื่องกำหนดประเภทและขนาดของโครงการหรือกิจการ' +
      'ซึ่งต้องจัดทำรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม และหลักเกณฑ์ วิธีการ ระเบียบปฏิบัติ' +
      ' และแนวทางการจัดทำรายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม'
    )
  }

  // ข้อ — traffic (ถ้ามี)
  if (formData.traffic_status === 'approved') {
    facts.push(
      '\t' + thaiNumeral(n++) + '. อาคารรายนี้ได้รับความเห็นชอบด้านการจราจร' +
      ' ตามหนังสือ ที่ กท ' + (formData.traffic_doc_no || '___') +
      ' ลงวันที่ ' + (formData.traffic_doc_date || '___')
    )
  }

  // ข้อ — การก่อสร้าง / ร้องเรียน
  if (formData.complaint === 'found') {
    facts.push(
      '\t' + thaiNumeral(n++) + '. จากการตรวจสอบ ' + (formData.construction_status || '___') +
      ' ถูกต้องตามแบบที่ได้รับอนุญาต'
    )
    facts.push(
      '\t' + thaiNumeral(n++) + '. พบการร้องเรียนเกี่ยวกับการ' +
      (ypo4 ? 'ก่อสร้าง' : 'ดัดแปลง') + 'อาคารรายนี้ ' +
      (formData.complaint_detail || '___')
    )
  } else {
    facts.push(
      '\t' + thaiNumeral(n++) + '. จากการตรวจสอบ ' + (formData.construction_status || '___') +
      ' ถูกต้องตามแบบที่ได้รับอนุญาต และไม่พบว่ามีการร้องเรียนเกี่ยวกับการ' +
      (ypo4 ? 'ก่อสร้าง' : 'ดัดแปลง') + 'อาคารรายนี้แต่อย่างใด'
    )
  }

  return facts
}

// ─── buildConsideration ───────────────────────────────────────
function buildConsideration(formData: FormData): string {
  const ypo4       = isYpo4(formData)
  const hn         = hasNew(formData)
  const hc         = hasChange(formData)
  const changes    = formData.supervisor_changes ?? []
  const activeSups = changes.flatMap((sc) =>
    sc.action === 'new' ? (sc.new_supervisors ?? []) : sc.to_supervisor ? [sc.to_supervisor] : []
  )

  const hasEngineer  = activeSups.some((s) => /^(สย|วย|ภย|ภส|สก|วก|สส|วส)/i.test(s.reg_no ?? ''))
  const hasArchitect = activeSups.some((s) => /^(ส-สถ|ว-สถ)/i.test(s.reg_no ?? ''))

  const unit      = ypo4 ? '\tส่วนควบคุมอาคาร ๑' : '\tเจ้าหน้าที่'
  const verbAct   = ypo4 ? 'ขยายระยะเวลาใบรับแจ้ง' : 'ต่ออายุใบอนุญาต'
  const verbPerm  = ypo4 ? 'ขอขยายระยะเวลาใบรับแจ้ง' : 'ต่ออายุใบอนุญาต'
  const verbFiled = ypo4 ? 'ผู้แจ้ง' : 'ผู้ได้รับใบอนุญาต'
  const extendYrs = formData.extend_years || '๑'

  let t =
    unit + 'ได้พิจารณาตามกฎกระทรวงกำหนดหลักเกณฑ์ วิธีการ และเงื่อนไขในการขออนุญาต' +
    ' การอนุญาต การต่ออายุใบอนุญาต การโอนใบอนุญาต การออกใบรับรอง และการออกใบแทน' +
    'ตามกฎหมายว่าด้วยการควบคุมอาคาร พ.ศ. ๒๕๖๔ เห็นว่า' + verbFiled +
    'ได้ยื่นคำขอ' + verbPerm + 'มาก่อนใบอนุญาตเดิมจะสิ้นอายุลง'

  if (!hn && !hc) {
    t += ' จึงเห็นควรอนุญาตให้' + verbAct + 'ออกไปอีก ' + extendYrs + ' ปี'
  } else {
    const mat29 = hn ? 'มาตรา ๒๙' : ''
    const mat30 = hc ? 'มาตรา ๓๐' : ''
    const mats  = [mat29, mat30].filter(Boolean).join(' และ ')

    const acts: string[] = []
    if (hasEngineer)  acts.push('พระราชบัญญัติวิศวกร พ.ศ. ๒๕๔๒')
    if (hasArchitect) acts.push('พระราชบัญญัติสถาปนิก พ.ศ. ๒๕๔๓')

    const notifyVerb = (hn && hc)
      ? 'การแจ้งชื่อผู้ควบคุมงานและการแจ้งเปลี่ยนชื่อผู้ควบคุมงาน'
      : hn ? 'การแจ้งชื่อผู้ควบคุมงาน'
           : 'การแจ้งเปลี่ยนชื่อผู้ควบคุมงาน'

    t +=
      ' และ' + notifyVerb + 'ไม่ขัดต่อ' + mats +
      ' แห่งพระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒ แก้ไขเพิ่มเติมโดยพระราชบัญญัติควบคุมอาคาร (ฉบับที่ ๒) พ.ศ. ๒๕๓๕ ' +
      acts.join(' ') + ' แต่อย่างใด' +
      ' จึงเห็นควรรับทราบ' + notifyVerb.replace(/^การ/, '') +
      ' และอนุญาตให้' + verbAct + 'ออกไปอีก ' + extendYrs + ' ปี'
  }

  t +=
    ' นับจากวันที่ ' + (formData.renew_from || '___') +
    ' ถึงวันที่ '   + (formData.renew_to   || '___') +
    ' โดยคิดค่าธรรมเนียม' + (ypo4
      ? 'การขอขยายระยะเวลาใบรับแจ้งการก่อสร้าง/ดัดแปลงอาคาร'
      : 'การต่ออายุใบอนุญาตการก่อสร้าง/ดัดแปลงอาคาร') +
    ' ' + (formData.fee || '๒๐๐.๐๐') + ' บาท'

  const authVerb = (hn || hc) ? 'รับทราบและ' : ''
  t +=
    ' อำนาจการ' + authVerb + 'ลงนามเป็นของผู้ว่าราชการกรุงเทพมหานคร' +
    'ในฐานะเจ้าพนักงานท้องถิ่นตามพระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒' +
    ' ซึ่งได้มอบอำนาจให้ผู้อำนวยการสำนักการโยธา ปฏิบัติราชการแทน' +
    'ตามคำสั่งกรุงเทพมหานครที่ ๕๒๒/๒๕๖๐ ลงวันที่ ๑๐ กุมภาพันธ์ ๒๕๖๐'

  return t
}

// ─── Context สำหรับ docxtemplater ────────────────────────────
function buildContext(formData: FormData, caseType: CaseType) {
  const ypo4 = isYpo4(formData)
  const facts = buildFacts(formData)
  return {
    doc_date:             formData.doc_date,
    officer_name:         formData.officer_name,
    officer_position:     formData.officer_position,
    owner_name:           formData.owner_name,
    owner_rep:            formData.owner_rep || formData.owner_name,
    permit_no:            formData.permit_no,
    permit_form:          formData.permit_form,
    permit_date:          formData.permit_date,
    permit_expire:        formData.permit_expire,
    building_desc:        formData.building_desc,
    location_soi:         formData.location_soi,
    location_road:        formData.location_road,
    location_subdistrict: formData.location_subdistrict,
    location_district:    formData.location_district,
    receipt_no:           formData.receipt_no,
    receipt_date:         formData.receipt_date,
    renew_count:          formData.renew_count,
    renew_from:           formData.renew_from,
    renew_to:             formData.renew_to,
    fee:                  formData.fee,
    extend_years:         formData.extend_years || '๑',
    title:                buildTitle(formData),
    intro:                buildIntro(formData),
    fact_lines:           facts,
    consideration:        buildConsideration(formData),
    has_eia:              formData.eia_status === 'approved',
    eia_doc_no:           formData.eia_doc_no ?? '',
    eia_doc_date:         formData.eia_doc_date ?? '',
    has_traffic:          formData.traffic_status === 'approved',
    traffic_doc_no:       formData.traffic_doc_no ?? '',
    traffic_doc_date:     formData.traffic_doc_date ?? '',
    has_complaint:        formData.complaint === 'found',
    complaint_detail:     formData.complaint_detail ?? 'ไม่พบ',
    construction_status:  formData.construction_status,
    is_ypo4:              ypo4,
    case_type:            caseType,
  }
}

// ─── Generate using docxtemplater ────────────────────────────
async function generateFromTemplate(
  formData: FormData,
  caseType: CaseType
): Promise<Buffer> {
  const templateBuf = fs.readFileSync(TEMPLATE_PATH)
  const zip = new PizZip(templateBuf)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })
  const context = buildContext(formData, caseType)
  doc.render(context)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

// ─── Fallback: Build from scratch (ถ้าไม่มี template) ────────
async function generateFromScratch(
  formData: FormData,
  _caseType: CaseType
): Promise<Buffer> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
  } = await import('docx')

  function p(
    text: string,
    opts: { bold?: boolean; center?: boolean; right?: boolean; indent?: boolean } = {}
  ) {
    const run = new TextRun({ text, bold: opts.bold })
    return new Paragraph({
      children: [run],
      alignment: opts.center
        ? AlignmentType.CENTER
        : opts.right
        ? AlignmentType.RIGHT
        : AlignmentType.JUSTIFIED,
      indent: opts.indent ? { firstLine: 720 } : undefined,
    })
  }

  function labelValue(label: string, value: string) {
    return new Paragraph({
      children: [
        new TextRun({ text: label + '  ', bold: true }),
        new TextRun(value),
      ],
    })
  }

  const title         = buildTitle(formData)
  const intro         = buildIntro(formData)
  const facts         = buildFacts(formData)
  const consideration = buildConsideration(formData)

  const docChildren = [
    p('บันทึกข้อความ', { bold: true, center: true }),
    new Paragraph({ text: '' }),
    labelValue('ส่วนราชการ', 'ส่วนควบคุมอาคาร ๑ (กลุ่มงานควบคุมอาคาร ๒  โทร. ๒๐๕๕)'),
    labelValue('ที่', 'กท ๐๙๐๗/'),
    labelValue('วันที่', formData.doc_date || ''),
    labelValue('เรื่อง', title),
    labelValue('เรียน', 'หัวหน้ากลุ่มงานควบคุมอาคาร ๒'),
    new Paragraph({ text: '' }),
    p(intro, { indent: true }),
    new Paragraph({ text: '' }),
    p('ข้อเท็จจริง', { bold: true }),
    ...facts.map((f) => p(f, { indent: true })),
    new Paragraph({ text: '' }),
    p('ข้อพิจารณาและเสนอแนะ', { bold: true }),
    p(consideration, { indent: true }),
    new Paragraph({ text: '' }),
    p('จึงเรียนมาเพื่อโปรดพิจารณา', { indent: true }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    p('(' + (formData.officer_name || 'นายปฐมรัฐ  ฟักสุวรรณ') + ')', { right: true }),
    p(formData.officer_position || 'วิศวกรโยธาชำนาญการ', { right: true }),
    p('กลุ่มงานควบคุมอาคาร ๒', { right: true }),
    p('ส่วนควบคุมอาคาร ๑  สำนักงานควบคุมอาคาร  สำนักการโยธา', { right: true }),
  ]

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'TH Sarabun New', size: 32 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 },
          },
        },
        children: docChildren,
      },
    ],
  })

  return Packer.toBuffer(doc)
}

// ─── Main Export ──────────────────────────────────────────────
export async function generateDoc(
  formData: FormData,
  caseType: CaseType = 'A'
): Promise<Buffer> {
  if (fs.existsSync(TEMPLATE_PATH)) {
    return generateFromTemplate(formData, caseType)
  }
  return generateFromScratch(formData, caseType)
}
