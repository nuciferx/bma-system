// app/api/cases/[id]/route.ts
// GET   /api/cases/[id] — building + all actions
// PATCH /api/cases/[id] — update latest action

import { NextRequest, NextResponse } from 'next/server'
import { getBuildingDetail, getActionsByBuilding, updateAction } from '@/lib/db/actions'
import type { Action } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const raw = await getBuildingDetail(id)
    if (!raw) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const { actions, attachments, ...buildingFields } = raw as Record<string, unknown> & {
      actions?: unknown[]
      attachments?: unknown[]
    }

    const data = {
      building: buildingFields,
      actions: (actions ?? []) as Action[],
      attachments: attachments ?? [],
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await req.json()) as Partial<Action>

    const actions = await getActionsByBuilding(id)
    if (actions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No actions found for this building' },
        { status: 404 }
      )
    }

    const updated = await updateAction(actions[0].action_id, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
