'use client'

import { APP_VERSION, AI_MODEL } from '@/lib/version'

interface SidebarProps {
  activeSection: string
  onNavigate: (s: string) => void
  onNewCase: () => void
  isOpen: boolean
  onClose: () => void
}

const MENU_ITEMS = [
  { key: 'home',       label: 'หน้าหลัก',                icon: '🏠' },
  { key: 'renewal',    label: 'ต่ออายุใบอนุญาต',          icon: '📋' },
  { key: 'supervisor', label: 'งานแจ้ง/เปลี่ยนคนคุมงาน', icon: '👷' },
  { key: 'permit',     label: 'งานอนุญาต',                icon: '📝', disabled: true },
] as const

export default function Sidebar({ activeSection, onNavigate, onNewCase, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-30
          flex flex-col
          transition-transform duration-200
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + title */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0">
              ก
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-tight">ระบบสารสนเทศ</p>
              <p className="text-xs text-slate-500 leading-tight">งานควบคุมอาคาร</p>
              <p className="text-[10px] text-slate-300 mt-0.5">{APP_VERSION} · {AI_MODEL}</p>
            </div>
          </div>
        </div>

        {/* New case button */}
        <div className="px-4 py-4 border-b border-slate-100">
          <button
            onClick={onNewCase}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <span>+</span>
            <span>เพิ่มใหม่</span>
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive = activeSection === item.key
            const isDisabled = 'disabled' in item && item.disabled

            if (isDisabled) {
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-50 pointer-events-none"
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1 text-sm text-slate-600">{item.label}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">เร็วๆ นี้</span>
                </div>
              )
            }

            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600 pl-[10px]'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
