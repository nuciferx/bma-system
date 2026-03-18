// เพิ่มตัวเลขนี้ทุกครั้งที่ deploy ครั้งใหม่
export const APP_VERSION = 'v1.3.0'

// เปลี่ยนตรงนี้ที่เดียว — ทั้ง OCR pipeline และ UI จะอัปเดตตาม
export const AI_MODEL = 'gemini-2.5-flash'

/**
 * Changelog v1.3.0
 * - Chunked OCR: แบ่งรูปภาพส่ง Gemini ทีละ 2 รูป แล้ว merge ผลลัพธ์ (ลดข้อผิดพลาด + รองรับเอกสารยาว)
 * - อัปเกรดเป็น Gemini Flash (รุ่นใหม่) เพื่อความแม่นยำสูงขึ้น
 * - เพิ่ม Image Panel ในหน้าตรวจสอบและบันทึก (ดูรูปต้นฉบับควบคู่ข้อมูล)
 * - ปรับปรุง OCR pipeline และ DOCX generator
 * - ลบ extract-form agent เก่าออก และ simplify orchestrator
 */
