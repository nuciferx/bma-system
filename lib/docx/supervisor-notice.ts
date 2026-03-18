// lib/docx/supervisor-notice.ts
// ─── Generator: บันทึกแจ้ง/เปลี่ยนผู้ควบคุมงาน ───────────────
// รองรับ อ.1 และ ยผ.4 / แจ้งชื่อ + เปลี่ยนตัว ในไฟล์เดียว

import type { FormData, SupervisorChange } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────
function isYpo4(f: FormData): boolean {
  return (f.permit_form ?? '').includes('ยผ')
}

function locationStr(f: FormData): string {
  return [
    f.location_soi         ? 'ซอย' + f.location_soi         : '',
    f.location_road        ? 'ถนน' + f.location_road        : '',
    f.location_subdistrict ? 'แขวง' + f.location_subdistrict : '',
    f.location_district    ? 'เขต' + f.location_district    : '',
    'กรุงเทพมหานคร',
  ].filter(Boolean).join(' ')
}

function verbChange(hasNew: boolean, hasChange: boolean, prefix = 'การ'): string {
  if (hasNew && hasChange) return prefix + 'แจ้งชื่อและเปลี่ยนชื่อผู้ควบคุมงาน'
  if (hasNew)              return prefix + 'แจ้งชื่อผู้ควบคุมงาน'
  return                          prefix + 'แจ้งเปลี่ยนชื่อผู้ควบคุมงาน'
}

function docTypeList(_hasNew: boolean, hasChange: boolean): string {
  const parts: string[] = []
  if (hasChange) parts.push('หนังสือแจ้งการบอกเลิกผู้ควบคุมงาน (แบบ น.5 และ น.6)')
  parts.push('หนังสือแสดงความยินยอมของผู้ควบคุมงานคนใหม่ (แบบ น.๔)')
  parts.push('หนังสือแจ้งชื่อผู้ควบคุมงานคนใหม่ (แบบ น.๗)')
  parts.push('สำเนาบัตรประจำตัวผู้ประกอบวิชาชีพฯ ที่ยังไม่สิ้นอายุ')
  return parts.join(' ')
}

// ─── buildTitle ───────────────────────────────────────────────
function buildTitle(f: FormData): string {
  const changes = f.supervisor_changes ?? []
  const hn = changes.some(c => c.action === 'new')
  const hc = changes.some(c => c.action === 'change')
  return verbChange(hn, hc) + ' ราย ' + (f.owner_name || '___')
}

// ─── buildIntro ───────────────────────────────────────────────
// คืนเป็น array ของบรรทัด (แต่ละบรรทัด = 1 paragraph)
function buildIntroLines(f: FormData): string[] {
  const ypo4 = isYpo4(f)
  const changes = f.supervisor_changes ?? []
  const permitLabel = ypo4
    ? 'ใบรับแจ้งการก่อสร้าง (แบบ ยผ.4)'
    : 'ใบอนุญาต (แบบ อ.1)'

  // Group changes by notice_receipt_no
  const groups: Map<string, SupervisorChange[]> = new Map()
  changes.forEach(c => {
    const key = c.notice_receipt_no || '_'
    const arr = groups.get(key) ?? []
    arr.push(c)
    groups.set(key, arr)
  })

  const lines: string[] = []
  let globalItemNo = 1

  groups.forEach((group) => {
    const s0 = group[0]
    const hn = group.some(c => c.action === 'new')
    const hc = group.some(c => c.action === 'change')

    const formType = hn && !hc
      ? '(แบบ น.3 และ น.4)'
      : !hn && hc
      ? '(น.4, น.5, น.6 และ น.7)'
      : '(น.3, น.4, น.5, น.6 และ น.7)'

    const verb = hn && !hc ? 'แจ้งชื่อผู้ควบคุมงาน'
               : !hn && hc ? 'ขอเปลี่ยนผู้ควบคุมงาน'
               : 'แจ้งชื่อและขอเปลี่ยนผู้ควบคุมงาน'

    lines.push(
      '\t' + (f.owner_name || '___') +
      ' โดย ' + (f.owner_rep || '___') +
      ' ได้มีหนังสือ เลขรับสำนักงานควบคุมอาคาร ที่ ท.' + (s0.notice_receipt_no || '___') +
      ' ลงวันที่ ' + (s0.notice_date || '___') +
      ' ' + formType + ' ' + verb +
      ' ตาม' + permitLabel +
      ' เลขที่ ' + (f.permit_no || '___') +
      ' ลงวันที่ ' + (f.permit_date || '___') + ' ดังนี้'
    )

    group.forEach(c => {
      if (c.action === 'new') {
        ;(c.new_supervisors ?? []).forEach(s => {
          lines.push(
            globalItemNo++ + '. ขอแจ้งชื่อ' + (s.role || 'ผู้ควบคุมงาน') +
            ' ' + (s.name || '___') +
            ' หมายเลขทะเบียน ' + (s.reg_no || '___')
          )
        })
      } else {
        const from = c.from_supervisor
        const to   = c.to_supervisor
        lines.push(
          globalItemNo++ + '. ขอเปลี่ยน' + (from?.role || 'ผู้ควบคุมงาน') +
          ' จาก' + (from?.name || '___') + ' หมายเลขทะเบียน ' + (from?.reg_no || '___') +
          ' เป็น ' + (to?.name || '___') + ' หมายเลขทะเบียน ' + (to?.reg_no || '___')
        )
      }
    })

    lines.push('ทั้งนี้ ตั้งแต่วันที่ ' + (s0.effective_date || '___') + ' เป็นต้นไป')
  })

  return lines
}

// ─── buildFacts ───────────────────────────────────────────────
function buildFactLines(f: FormData): string[] {
  const ypo4 = isYpo4(f)
  const loc  = locationStr(f)
  const changes = f.supervisor_changes ?? []
  const hn = changes.some(c => c.action === 'new')
  const hc = changes.some(c => c.action === 'change')
  const permitLabel = ypo4 ? 'ยผ.4' : 'อ.1'
  const permitDesc  = ypo4 ? 'ใบรับแจ้งการก่อสร้าง' : 'ใบอนุญาต'
  const requester   = ypo4 ? 'ผู้แจ้ง' : 'ผู้ขออนุญาต'

  // สรุปผู้ควบคุมใหม่ (เพื่อตรวจ วิศวกร/สถาปนิก)
  const newSups = changes.flatMap(c =>
    c.action === 'new' ? (c.new_supervisors ?? []) : c.to_supervisor ? [c.to_supervisor] : []
  )
  const hasEngineer  = newSups.some(s => /^(สย|วย|ภย|สก|วก|สส|วส|สฟก|วฟก)/i.test(s.reg_no ?? ''))
  const hasArchitect = newSups.some(s => /^(ส-สถ|ว-สถ)/i.test(s.reg_no ?? ''))

  const mats: string[] = []
  if (hn) mats.push('มาตรา ๒๙')
  if (hc) mats.push('มาตรา ๓๐')
  const actsStr = [
    'พระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒ แก้ไขเพิ่มเติมโดยพระราชบัญญัติควบคุมอาคาร (ฉบับที่ ๒) พ.ศ. ๒๕๓๕',
    hasEngineer  ? 'และพระราชบัญญัติวิศวกร พ.ศ. ๒๕๔๒'  : '',
    hasArchitect ? 'และพระราชบัญญัติสถาปนิก พ.ศ. ๒๕๔๓' : '',
  ].filter(Boolean).join(' ')

  const lines: string[] = []
  let n = 1

  // ─── ข้อ 1: อาคาร + ผู้ควบคุมเดิม ──────────────────────────
  lines.push(
    '\t' + n++ + '. ' + (f.owner_name || '___') +
    ' โดย ' + (f.owner_rep || '___') +
    ' ได้รับ' + permitDesc + 'การก่อสร้างอาคาร' + (f.building_desc || '___') +
    ' จำนวน 1 หลัง' +
    ' ที่' + loc +
    ' ตาม' + permitDesc + ' (แบบ ' + permitLabel + ')' +
    ' เลขที่ ' + (f.permit_no || '___') +
    ' ลงวันที่ ' + (f.permit_date || '___') +
    ' สิ้นอายุวันที่ ' + (f.permit_expire || '___') +
    (ypo4
      ? ' ซึ่งผู้ว่าราชการกรุงเทพมหานครได้รับทราบแบบแปลนไม่ขัดข้องฯ แล้ว เมื่อวันที่ ' +
        (f.ypo4_ack_date || '……………………………')
      : '') +
    ' โดยมีผู้ควบคุมงานดังนี้'
  )

  const origSups = f.original_supervisors ?? []
  origSups.forEach((s, i) => {
    lines.push(
      (n - 1) + '.' + (i + 1) + ' ' + (s.name || '___') +
      ' หมายเลขทะเบียน ' + (s.reg_no || '___') +
      ' เป็น' + (s.role || 'ผู้ควบคุมงาน')
    )
  })

  // ─── ข้อ 2: ตรวจสอบเอกสาร ───────────────────────────────────
  lines.push(
    '\t' + n++ + '. ' + verbChange(hn, hc) + 'ครั้งนี้ ' + requester + 'ได้แนบ' +
    docTypeList(hn, hc) + ' มาด้วยแล้ว' +
    ' ได้พิจารณาแล้วไม่ขัด' + mats.join(' และ') +
    ' แห่ง' + actsStr + ' แต่อย่างใด'
  )

  // ─── ข้อ 3: สถานะก่อสร้าง ───────────────────────────────────
  const complaint = f.complaint === 'found'
    ? ' พบการร้องเรียน: ' + (f.complaint_detail || '___')
    : ' และไม่พบว่ามีการร้องเรียนเกี่ยวกับการก่อสร้างอาคารรายนี้แต่อย่างใด'

  lines.push(
    '\t' + n++ + '. จากการตรวจสอบ อาคารอยู่ระหว่าง' +
    (f.construction_status || '___') +
    ' ถูกต้องตามแบบที่ได้รับอนุญาต' + complaint
  )

  return lines
}

// ─── buildConsideration ───────────────────────────────────────
function buildConsideration(f: FormData): string {
  const changes = f.supervisor_changes ?? []
  const hn = changes.some(c => c.action === 'new')
  const hc = changes.some(c => c.action === 'change')

  const newSups = changes.flatMap(c =>
    c.action === 'new' ? (c.new_supervisors ?? []) : c.to_supervisor ? [c.to_supervisor] : []
  )
  const hasEngineer  = newSups.some(s => /^(สย|วย|ภย|สก|วก|สส|วส|สฟก|วฟก)/i.test(s.reg_no ?? ''))
  const hasArchitect = newSups.some(s => /^(ส-สถ|ว-สถ)/i.test(s.reg_no ?? ''))

  const mats: string[] = []
  if (hn) mats.push('มาตรา ๒๙')
  if (hc) mats.push('มาตรา ๓๐')
  const actsStr = [
    'พระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒ แก้ไขเพิ่มเติมโดยพระราชบัญญัติควบคุมอาคาร (ฉบับที่ ๒) พ.ศ. ๒๕๓๕',
    hasEngineer  ? 'และพระราชบัญญัติวิศวกร พ.ศ. ๒๕๔๒'  : '',
    hasArchitect ? 'และพระราชบัญญัติสถาปนิก พ.ศ. ๒๕๔๓' : '',
  ].filter(Boolean).join(' ')

  const vc = verbChange(hn, hc)
  const vcShort = vc.replace(/^การ/, '')

  return (
    '\tเจ้าหน้าที่พิจารณาแล้ว ' + vc +
    'ดังกล่าวไม่ขัด' + mats.join(' และ') +
    ' แห่ง' + actsStr + ' แต่อย่างใด' +
    ' เห็นควรนำเรียนผู้ว่าราชการกรุงเทพมหานครในฐานะเจ้าพนักงานท้องถิ่น รับทราบ' +
    vcShort + 'รายดังกล่าวต่อไป' +
    ' อำนาจการรับทราบเป็นของผู้ว่าราชการกรุงเทพมหานครในฐานะเจ้าพนักงานท้องถิ่น' +
    'ตามพระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒ ซึ่งได้มอบอำนาจให้ผู้อำนวยการสำนักการโยธา' +
    'ปฏิบัติราชการแทนตามคำสั่งกรุงเทพมหานครที่ ๕๒๒/๒๕๖๐ ลงวันที่ ๑๐ กุมภาพันธ์ ๒๕๖๐'
  )
}

// ─── Main Export ──────────────────────────────────────────────
export async function generateSupervisorNoticeDoc(f: FormData): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
  } = await import('docx')

  function p(
    text: string,
    opts: { bold?: boolean; center?: boolean; right?: boolean; indent?: boolean } = {}
  ) {
    const indent = opts.indent || text.startsWith('\t')
    return new Paragraph({
      children: [new TextRun({ text: text.replace(/^\t/, ''), bold: opts.bold })],
      alignment: opts.center
        ? AlignmentType.CENTER
        : opts.right
        ? AlignmentType.RIGHT
        : AlignmentType.JUSTIFIED,
      indent: indent ? { firstLine: 720 } : undefined,
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

  const title         = buildTitle(f)
  const introLines    = buildIntroLines(f)
  const factLines     = buildFactLines(f)
  const consideration = buildConsideration(f)

  const children = [
    p('บันทึกข้อความ', { bold: true, center: true }),
    new Paragraph({ text: '' }),
    labelValue('ส่วนราชการ', 'ส่วนควบคุมอาคาร ๑ (กลุ่มงานควบคุมอาคาร ๒  โทร. ๒๐๕๕)'),
    labelValue('ที่', ''),
    labelValue('วันที่', f.doc_date || ''),
    labelValue('เรื่อง', title),
    labelValue('เรียน', 'หัวหน้ากลุ่มงานควบคุมอาคาร ๒'),
    new Paragraph({ text: '' }),
    p('ต้นเรื่อง', { bold: true }),
    ...introLines.map(line => p(line)),
    new Paragraph({ text: '' }),
    p('ข้อเท็จจริง', { bold: true }),
    p('\tเจ้าหน้าที่ได้ตรวจสอบแล้วปรากฏดังนี้'),
    ...factLines.map(line => p(line)),
    new Paragraph({ text: '' }),
    p('ข้อพิจารณาและเสนอแนะ', { bold: true }),
    p(consideration),
    new Paragraph({ text: '' }),
    p('\tจึงเรียนมาเพื่อโปรดพิจารณา'),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    p('(' + (f.officer_name || 'นายปฐมรัฐ  ฟักสุวรรณ') + ')', { right: true }),
    p(f.officer_position || 'วิศวกรโยธาชำนาญการ', { right: true }),
    p('กลุ่มงานควบคุมอาคาร ๒', { right: true }),
    p('ส่วนควบคุมอาคาร ๑  สำนักงานควบคุมอาคาร  สำนักการโยธา', { right: true }),
  ]

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'TH Sarabun New', size: 32 } } },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } },
      },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
