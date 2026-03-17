'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { OcrRequest, ScanMode } from '@/types'

interface UploadZoneProps {
  onSubmit: (req: OcrRequest) => void
  isLoading: boolean
}

interface PageThumb {
  dataUrl: string
  pageNum: number
  selected: boolean
  fileIndex: number
}

declare const pdfjsLib: {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> }
  GlobalWorkerOptions: { workerSrc: string }
}

interface PdfDoc {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
}

interface PdfPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: ReturnType<PdfPage['getViewport']> }) => { promise: Promise<void> }
}

async function pdfToThumbs(file: File, fileIndex: number): Promise<PageThumb[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf: PdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const thumbs: PageThumb[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    thumbs.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.8), pageNum: i, selected: true, fileIndex })
  }
  return thumbs
}

async function imageToThumb(file: File, fileIndex: number): Promise<PageThumb> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve({ dataUrl: e.target!.result as string, pageNum: 1, selected: true, fileIndex })
    }
    reader.readAsDataURL(file)
  })
}

async function thumbToBase64Jpeg(dataUrl: string): Promise<string> {
  return dataUrl.split(',')[1]
}

export default function UploadZone({ onSubmit, isLoading }: UploadZoneProps) {
  const [mode, setMode] = useState<ScanMode>('A')
  const [previousCaseId, setPreviousCaseId] = useState('')
  const [thumbs, setThumbs] = useState<PageThumb[]>([])
  const [oldThumbs, setOldThumbs] = useState<PageThumb[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isOldDragging, setIsOldDragging] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const oldInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfReady(true)
    }
    document.head.appendChild(script)
  }, [])

  const processFiles = useCallback(async (files: File[], isOld = false) => {
    const results: PageThumb[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.type === 'application/pdf') {
        if (!pdfReady) continue
        const pages = await pdfToThumbs(f, i)
        results.push(...pages)
      } else if (f.type.startsWith('image/')) {
        const t = await imageToThumb(f, i)
        results.push(t)
      }
    }
    if (isOld) setOldThumbs(results)
    else setThumbs(results)
  }, [pdfReady])

  const handleDrop = useCallback((e: React.DragEvent, isOld = false) => {
    e.preventDefault()
    isOld ? setIsOldDragging(false) : setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files, isOld)
  }, [processFiles])

  const toggleThumb = (index: number, isOld = false) => {
    if (isOld) {
      setOldThumbs(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t))
    } else {
      setThumbs(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t))
    }
  }

  const handleSubmit = async () => {
    const selected = thumbs.filter(t => t.selected)
    const newImages = await Promise.all(selected.map(t => thumbToBase64Jpeg(t.dataUrl)))
    const req: OcrRequest = {
      new_doc_images: newImages,
      mode,
      ...(mode === 'B' && { previous_case_id: previousCaseId }),
      ...(mode === 'C' && {
        old_doc_images: await Promise.all(
          oldThumbs.filter(t => t.selected).map(t => thumbToBase64Jpeg(t.dataUrl))
        )
      })
    }
    onSubmit(req)
  }

  const selectedCount = thumbs.filter(t => t.selected).length

  const DropArea = ({ isOld = false }: { isOld?: boolean }) => {
    const dragging = isOld ? isOldDragging : isDragging
    const list = isOld ? oldThumbs : thumbs
    return (
      <div
        onDragOver={e => { e.preventDefault(); isOld ? setIsOldDragging(true) : setIsDragging(true) }}
        onDragLeave={() => isOld ? setIsOldDragging(false) : setIsDragging(false)}
        onDrop={e => handleDrop(e, isOld)}
        onClick={() => (isOld ? oldInputRef : inputRef).current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer
          ${dragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40'}
          ${list.length > 0 ? 'p-3 min-h-[120px]' : 'p-10 flex flex-col items-center justify-center min-h-[160px]'}`}
      >
        <input
          ref={isOld ? oldInputRef : inputRef}
          type="file"
          multiple
          accept=".pdf,image/jpeg,image/png"
          className="hidden"
          onChange={e => { if (e.target.files) processFiles(Array.from(e.target.files), isOld) }}
        />
        {list.length === 0 ? (
          <div className="text-center pointer-events-none">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm font-medium text-slate-600">
              {isOld ? 'วางเอกสารครั้งก่อน' : 'วาง PDF หรือรูปภาพที่นี่'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
            {list.map((t, i) => (
              <div
                key={i}
                onClick={() => toggleThumb(i, isOld)}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all bg-slate-100
                  ${t.selected ? 'border-blue-500 shadow-md shadow-blue-200' : 'border-transparent opacity-50 grayscale'}`}
              >
                <img src={t.dataUrl} alt={`หน้า ${t.pageNum}`} className="w-full h-64 object-contain" />
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity
                  ${t.selected ? 'opacity-0 hover:opacity-100' : 'opacity-100'} bg-black/30`}>
                  <span className="text-white text-2xl">{t.selected ? '✓' : '+'}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-1 font-medium">
                  หน้า {t.pageNum}
                </div>
              </div>
            ))}
            <div
              onClick={() => (isOld ? oldInputRef : inputRef).current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg h-64 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-400 cursor-pointer transition-colors"
            >
              <span className="text-3xl">+</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const modes: { value: ScanMode; label: string; desc: string }[] = [
    { value: 'A', label: 'A', desc: 'ครั้งแรก (ไม่มีประวัติ)' },
    { value: 'B', label: 'B', desc: 'ต่ออายุครั้งที่ 2+ (มีใน DB)' },
    { value: 'C', label: 'C', desc: 'บรรจุใหม่ (สแกนเรื่องเก่าด้วย)' },
  ]

  return (
    <div className="space-y-5 font-[var(--font-sans)]">
      {/* Mode Selector */}
      <div className="flex gap-2">
        {modes.map(m => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-left transition-all
              ${mode === m.value
                ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
          >
            <div className="font-bold text-sm">โหมด {m.value}</div>
            <div className={`text-xs mt-0.5 ${mode === m.value ? 'text-blue-100' : 'text-slate-400'}`}>
              {m.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Mode B: previous_case_id */}
      {mode === 'B' && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-600 text-sm font-medium whitespace-nowrap">รหัสเคสเดิม</span>
          <input
            type="text"
            value={previousCaseId}
            onChange={e => setPreviousCaseId(e.target.value)}
            placeholder="กรอก previous_case_id"
            className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}

      {/* Main Drop Zone */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">เอกสารครั้งนี้</span>
          {selectedCount > 0 && (
            <span className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-medium">
              เลือก {selectedCount} หน้า
            </span>
          )}
        </div>
        <DropArea />
      </div>

      {/* Mode C: old doc zone */}
      {mode === 'C' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-700">เอกสารเรื่องเก่า</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">โหมด C</span>
          </div>
          <DropArea isOld />
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || selectedCount === 0}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all
          ${isLoading || selectedCount === 0
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'}`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            กำลังวิเคราะห์…
          </span>
        ) : `วิเคราะห์ ${selectedCount > 0 ? `(${selectedCount} หน้า)` : ''}`}
      </button>
    </div>
  )
}
