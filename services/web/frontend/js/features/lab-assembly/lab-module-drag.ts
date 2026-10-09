import type { Module } from './lab-assembly-widget'

export type DropPosition = 'before' | 'inside' | 'after'
export function dropPosition(
  y: number,
  top: number,
  height: number
): DropPosition {
  const ratio = (y - top) / height
  return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
}

export function dropMove(
  modules: Module[],
  sourceId: string,
  targetId: string,
  position: DropPosition
) {
  const source = modules.find(m => m.id === sourceId)
  const target = modules.find(m => m.id === targetId)
  if (!source || !target || sourceId === targetId) return null
  const parentId = position === 'inside' ? target.id : target.parentId
  const parent = modules.find(m => m.id === parentId)
  if (parentId !== null) {
    if (!parent || ['table', 'figure'].includes(parent.kind)) return null
    if (['abstract', 'highlights'].includes(source.kind)) return null
    if (
      ['table', 'figure'].includes(source.kind) &&
      !['section', 'unnumbered'].includes(parent.kind)
    )
      return null
  }
  // Check the complete moved subtree, not only its top item.
  const candidate = new Map(
    modules.map(m => [m.id, m.id === sourceId ? { ...m, parentId } : m])
  )
  for (const module of candidate.values()) {
    const seen = new Set([module.id])
    let id = module.parentId,
      depth = 1
    while (id !== null) {
      if (seen.has(id) || !candidate.has(id)) return null
      seen.add(id)
      id = candidate.get(id)!.parentId
      if (++depth > 3) return null
    }
  }
  const siblings = modules.filter(
    m => m.parentId === target.parentId && m.id !== sourceId
  )
  return {
    type: 'move' as const,
    id: sourceId,
    parentId,
    beforeId:
      position === 'before'
        ? targetId
        : position === 'after'
          ? siblings[siblings.findIndex(m => m.id === targetId) + 1]?.id || null
          : null
  }
}
