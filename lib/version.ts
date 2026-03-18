// เพิ่มตัวเลขนี้ทุกครั้งที่ deploy ครั้งใหม่
export const APP_VERSION = 'v1.3.0'

/**
 * Changelog v1.3.0
 * - Chunked OCR: แบ่งรูปภาพส่ง Gemini ทีละ 2 รูป แล้ว merge ผลลัพธ์ (ลดข้อผิดพลาด + รองรับเอกสารยาว)
 * - อัปเกรดเป็น Gemini Flash (รุ่นใหม่) เพื่อความแม่นยำสูงขึ้น
 * - เพิ่ม Image Panel ในหน้าตรวจสอบและบันทึก (ดูรูปต้นฉบับควบคู่ข้อมูล)
 * - ปรับปรุง OCR pipeline และ DOCX generator
 * - ลบ extract-form agent เก่าออก และ simplify orchestrator
 */
