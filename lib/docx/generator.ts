// lib/docx/generator.ts
// ─── Docx Generator ───────────────────────────────────────────
// รับ FormData + CaseType → คืน Buffer (.docx)

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'
import type { FormData, CaseType } from '@/types'

const TEMPLATE_PATH = path.join(process.cwd(), 'lib', 'docx', 'template.docx')

// ─── Case Config ──────────────────────────────────────────────
function getCaseConfig(caseType: CaseType, formData: FormData) {
  const isYpo4 = ['D', 'E', 'F'].includes(caseType)
  const verb = isYpo4 ? 'ขยายระยะเวลา' : 'ต่ออายุ'
  const hasSupervisorChange =
    ['B', 'C', 'BC', 'E', 'F'].includes(caseType) ||
    formData.supervisor_changes.length > 0
  const sections_cited = hasSupervisorChange ? 'มาตรา 29 และมาตรา 30' : 'มาตรา 29'
  const formLabel = isYpo4 ? 'ยผ.4' : 'อ.1'
  return { verb, sections_cited, formLabel, hasSupervisorChange }
}

// ─── Text Builders ────────────────────────────────────────────
function buildOrigSupText(formData: FormData): string {
  if (formData.orig_sup_status === 'none') return 'ยังไม่มีการแจ้งชื่อผู้ควบคุมงาน'
  return formData.original_supervisors
    .map((s) => `${s.name} (${s.reg_no}) ตำแหน่ง ${s.role}`)
    .join(', ')
}

function buildSupervisorChangeLines(formData: FormData): string[] {
  return formData.supervisor_changes.map((sc) => {
    if (sc.action === 'new') {
      const names = (sc.new_supervisors ?? []).map((s) => `${s.name} (${s.reg_no})`).join(', ')
      return `แจ้งชื่อผู้ควบคุมงาน ${names} เลขรับ ${sc.notice_receipt_no} วันที่ ${sc.notice_date}`
    }
    const from = sc.from_supervisor
      ? `${sc.from_supervisor.name} (${sc.from_supervisor.reg_no})`
      : '-'
    const to = sc.to_supervisor
      ? `${sc.to_supervisor.name} (${sc.to_supervisor.reg_no})`
      : '-'
    return `เปลี่ยนผู้ควบคุมงานจาก ${from} เป็น ${to} เลขรับ ${sc.notice_receipt_no} วันที่ ${sc.notice_date}`
  })
}

function buildHistoryLines(formData: FormData): string[] {
  return formData.supervisor_history.map(
    (h, i) =>
      `ครั้งที่ ${i + 1}: ${h.action_detail} เลขรับ ${h.receipt_no} รับทราบโดยหนังสือ ${h.ack_doc_no} วันที่ ${h.ack_doc_date}`
  )
}

// ─── Context สำหรับ docxtemplater ────────────────────────────
function buildContext(formData: FormData, caseType: CaseType) {
  const { verb, sections_cited, formLabel, hasSupervisorChange } = getCaseConfig(
    caseType,
    formData
  )
  const supervisorChangeLines = buildSupervisorChangeLines(formData)
  const historyLines = buildHistoryLines(formData)

  return {
    doc_date: formData.doc_date,
    officer_name: formData.officer_name,
    officer_position: formData.officer_position,
    owner_name: formData.owner_name,
    owner_rep: formData.owner_rep || formData.owner_name,
    permit_no: formData.permit_no,
    permit_form: formData.permit_form,
    permit_date: formData.permit_date,
    permit_expire: formData.permit_expire,
    building_desc: formData.building_desc,
    location_soi: formData.location_soi,
    location_road: formData.location_road,
    location_subdistrict: formData.location_subdistrict,
    location_district: formData.location_district,
    receipt_no: formData.receipt_no,
    receipt_date: formData.receipt_date,
    renew_count: formData.renew_count,
    renew_from: formData.renew_from,
    renew_to: formData.renew_to,
    fee: formData.fee,
    verb,
    form_label: formLabel,
    sections_cited,
    orig_sup_text: buildOrigSupText(formData),
    has_supervisor_change: hasSupervisorChange,
    supervisor_change_lines: supervisorChangeLines,
    has_history: historyLines.length > 0,
    history_lines: historyLines,
    has_eia: formData.eia_status === 'approved',
    eia_doc_no: formData.eia_doc_no ?? '',
    eia_doc_date: formData.eia_doc_date ?? '',
    construction_status: formData.construction_status,
    has_complaint: formData.complaint === 'found',
    complaint_detail: formData.complaint_detail ?? 'ไม่พบ',
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

// Thai ordinal numerals (๑-๑๐)
const THAI_NUM = ['', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙', '๑๐']
function thaiNumeral(n: number): string {
  return THAI_NUM[n] ?? String(n)
}

// ─── Fallback: Build from scratch (ถ้าไม่มี template) ────────
async function generateFromScratch(
  formData: FormData,
  caseType: CaseType
): Promise<Buffer> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
  } = await import('docx')

  const { verb, sections_cited, formLabel } = getCaseConfig(caseType, formData)
  const context = buildContext(formData, caseType)

  function makeLabelValuePara(label: string, value: string) {
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}  `, bold: true }),
        new TextRun(value),
      ],
    })
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'TH Sarabun New', size: 32 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 850, bottom: 1134, left: 1701 },
          },
        },
        children: [
          new Paragraph({
            text: 'บันทึกข้อความ',
            alignment: AlignmentType.CENTER,
          }),
          makeLabelValuePara('ส่วนราชการ', 'กลุ่มควบคุมอาคาร สำนักการโยธา กรุงเทพมหานคร'),
          makeLabelValuePara('ที่', 'กท 0907/'),
          makeLabelValuePara('วันที่', formData.doc_date),
          makeLabelValuePara(
            'เรื่อง',
            `ขอ${verb}ใบอนุญาตก่อสร้างอาคาร แบบ ${formLabel} เลขที่ ${formData.permit_no}`
          ),
          makeLabelValuePara('เรียน', 'ผู้อำนวยการสำนักการโยธา'),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [
              new TextRun(
                `${formData.owner_name || formData.owner_rep} ยื่นคำขอ${verb}ใบอนุญาตก่อสร้างอาคาร ` +
                `ตามแบบ ${formLabel} เลขที่ ${formData.permit_no} ` +
                `ลงวันที่ ${formData.permit_date} สิ้นอายุ ${formData.permit_expire} ` +
                `สำหรับ${formData.building_desc} ตั้งอยู่ ${formData.location_soi} ` +
                `ถนน${formData.location_road} แขวง${formData.location_subdistrict} ` +
                `เขต${formData.location_district} กรุงเทพมหานคร ` +
                `เลขรับ ${formData.receipt_no} วันที่ ${formData.receipt_date} ` +
                `${verb}ครั้งที่ ${formData.renew_count} ตั้งแต่วันที่ ${formData.renew_from} ` +
                `ถึงวันที่ ${formData.renew_to} ค่าธรรมเนียม ${formData.fee} บาท`
              ),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: 'ข้อเท็จจริง', bold: true })],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [
              new TextRun(
                `ข้อ ๑ ใบอนุญาตก่อสร้างอาคาร แบบ ${formLabel} เลขที่ ${formData.permit_no} ` +
                `ออกให้แก่ ${formData.owner_name} ลงวันที่ ${formData.permit_date} ` +
                `สำหรับ${formData.building_desc}`
              ),
            ],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [
              new TextRun(`ข้อ ๒ ผู้ควบคุมงานตามใบอนุญาตเดิม: ${context.orig_sup_text}`),
            ],
          }),

          ...context.supervisor_change_lines.map(
            (line, i) =>
              new Paragraph({
                indent: { firstLine: 720 },
                children: [new TextRun(`ข้อ ${thaiNumeral(i + 3)} ${line}`)],
              })
          ),

          ...(context.has_eia
            ? [
                new Paragraph({
                  indent: { firstLine: 720 },
                  children: [
                    new TextRun(
                      `อาคารนี้อยู่ในข่ายต้องจัดทำรายงาน EIA ได้รับความเห็นชอบตามหนังสือ ${formData.eia_doc_no} ลงวันที่ ${formData.eia_doc_date}`
                    ),
                  ],
                }),
              ]
            : []),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [new TextRun(`สภาพการก่อสร้าง: ${formData.construction_status}`)],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [
              new TextRun(
                `การร้องเรียน: ${context.has_complaint ? formData.complaint_detail : 'ไม่พบ'}`
              ),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: 'ข้อพิจารณาและเสนอแนะ', bold: true })],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [
              new TextRun(
                `เห็นควร${verb}ใบอนุญาตก่อสร้างอาคาร แบบ ${formLabel} เลขที่ ${formData.permit_no} ` +
                `ตาม${sections_cited} แห่งพระราชบัญญัติควบคุมอาคาร พ.ศ. ๒๕๒๒ ` +
                `${verb}ครั้งที่ ${formData.renew_count} ตั้งแต่ ${formData.renew_from} ถึง ${formData.renew_to}`
              ),
            ],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            children: [new TextRun('จึงเรียนมาเพื่อโปรดพิจารณา')],
          }),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun(`(${formData.officer_name})`)],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun(formData.officer_position)],
          }),
        ],
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
