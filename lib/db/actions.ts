// lib/db/actions.ts
// ============================================================
// DB helpers — Buildings + Actions
// merged จากทั้งสองชุด
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { Action, Building, SupervisorHistoryRecord } from '@/types'

function getClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase env not set (SUPABASE_URL, SUPABASE_SERVICE_KEY)')
  return createClient(url, key)
}

// ─── Read ────────────────────────────────────────────────────

export async function getBuilding(buildingId: string): Promise<Building> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('building_id', buildingId)
    .single()

  if (error) throw new Error(`getBuilding: ${error.message}`)
  if (!data) throw new Error(`Building not found: ${buildingId}`)
  return data as Building
}

export async function getActionsByBuilding(buildingId: string): Promise<Action[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getActionsByBuilding: ${error.message}`)
  return (data ?? []) as Action[]
}

export async function getLatestAction(buildingId: string): Promise<Action | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getLatestAction: ${error.message}`)
  return (data as Action) ?? null
}

// ดึง supervisor history ของ building — ใช้ใน mode B
export async function getActionHistory(
  buildingId: string
): Promise<SupervisorHistoryRecord[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('actions')
    .select('receipt_no, receipt_date, supervisor_changes, ack_doc_no, ack_doc_date')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getActionHistory: ${error.message}`)

  return (data ?? []).map((a) => ({
    receipt_no: (a.receipt_no as string) ?? '',
    date: (a.receipt_date as string) ?? '',
    action_detail: formatActionDetail((a.supervisor_changes as Action['supervisor_changes']) ?? []),
    ack_doc_no: (a.ack_doc_no as string) ?? '',
    ack_doc_date: (a.ack_doc_date as string) ?? '',
    ack_date: (a.ack_doc_date as string) ?? '',
  }))
}

function formatActionDetail(changes: Action['supervisor_changes']): string {
  if (!changes.length) return 'ต่ออายุโดยไม่มีการเปลี่ยนแปลงผู้ควบคุม'
  return changes
    .map((c) => {
      if (c.action === 'new') {
        const names = (c.new_supervisors ?? []).map((s) => s.name).join(', ')
        return `แจ้งชื่อผู้ควบคุมงาน: ${names}`
      }
      return `เปลี่ยนผู้ควบคุมงาน จาก ${c.from_supervisor?.name ?? '-'} เป็น ${c.to_supervisor?.name ?? '-'}`
    })
    .join('; ')
}

// ─── Write ───────────────────────────────────────────────────

export async function saveCase(
  building: Omit<Building, 'building_id' | 'created_at'>,
  action: Omit<Action, 'action_id' | 'building_id' | 'created_at'>
): Promise<{ building_id: string; action_id: string }> {
  const supabase = getClient()

  const { data: bData, error: bErr } = await supabase
    .from('buildings')
    .upsert({ ...building }, { onConflict: 'permit_no' })
    .select('building_id')
    .single()

  if (bErr) throw new Error(`save building: ${bErr.message}`)

  const building_id: string = (bData as { building_id: string }).building_id

  const { data: aData, error: aErr } = await supabase
    .from('actions')
    .insert({ ...action, building_id })
    .select('action_id')
    .single()

  if (aErr) throw new Error(`save action: ${aErr.message}`)

  return { building_id, action_id: (aData as { action_id: string }).action_id }
}

export async function updateAction(
  actionId: string,
  data: Partial<Action>
): Promise<Action> {
  const supabase = getClient()
  const { data: result, error } = await supabase
    .from('actions')
    .update(data)
    .eq('action_id', actionId)
    .select()
    .single()

  if (error) throw new Error(`updateAction: ${error.message}`)
  if (!result) throw new Error('updateAction: no result returned')
  return result as Action
}

// ─── Search ──────────────────────────────────────────────────

export async function searchBuildings(query: string) {
  const supabase = getClient()
  const q = query.trim().slice(0, 100)

  const { data, error } = await supabase
    .from('buildings')
    .select(`
      building_id, permit_no, permit_form, owner_name, permit_expire,
      location_district,
      actions(action_id, case_type, renew_count, doc_date, created_at)
    `)
    .or(`owner_name.ilike.%${q}%,permit_no.ilike.%${q}%`)
    .order('created_at', { referencedTable: 'actions', ascending: false })
    .limit(20)

  if (error) throw new Error(`searchBuildings: ${error.message}`)
  return data ?? []
}

export async function getRecentBuildings(limit = 20) {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentBuildings: ${error.message}`)
  return (data ?? []) as Building[]
}

export async function getBuildingDetail(buildingId: string) {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('buildings')
    .select('*, actions(*), attachments(*)')
    .eq('building_id', buildingId)
    .single()

  if (error) throw new Error(`getBuildingDetail: ${error.message}`)
  return data
}
