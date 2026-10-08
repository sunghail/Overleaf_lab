import { randomUUID } from 'node:crypto'
import { AssemblyError, escapeLatex } from './LabLatex.mjs'
import { createTable, validateTable } from './LabTableModel.mjs'
import { CLEANER_PROFILE, cleanerPreamble } from './LabCleanerTemplate.mjs'
export { AssemblyError, escapeLatex } from './LabLatex.mjs'

export const MANIFEST_NAME = 'lab-assembly.json'
export const MAIN_NAME = 'lab-assembled.tex'
const ID_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const KINDS = ['section', 'abstract', 'highlights', 'unnumbered', 'table']
const SECTION_COMMANDS = ['section', 'subsection', 'subsubsection']

function check(condition, message) {
  if (!condition) throw new AssemblyError(message)
}

function validTitle(title) {
  check(
    typeof title === 'string' && title.trim().length > 0 && title.length <= 200,
    '제목을 1–200자로 입력해 주세요.',
  )
}

export function moduleFilename(id) {
  check(
    typeof id === 'string' && ID_PATTERN.test(id),
    '모듈 식별자가 올바르지 않습니다.',
  )
  return `lab-module-${id}.tex`
}

export function validateManifest(manifest) {
  check(
    manifest?.format === 'overleaf-lab-assembly' &&
      manifest.schemaVersion === 1,
    '지원하지 않는 조립 설정입니다.',
  )
  check(
    Number.isSafeInteger(manifest.version) && manifest.version >= 1,
    '조립 설정의 버전이 올바르지 않습니다.',
  )
  validTitle(manifest.title)
  check(
    manifest.profile === undefined || manifest.profile === CLEANER_PROFILE,
    '지원하지 않는 저널 양식입니다.',
  )
  if (manifest.metadata) {
    check(
      ['authors', 'affiliations', 'authorNotes'].every(
        key =>
          typeof manifest.metadata[key] === 'string' &&
          manifest.metadata[key].length <= 3000,
      ),
      '원고 정보를 확인해 주세요.',
    )
  }
  check(
    Array.isArray(manifest.modules) && manifest.modules.length <= 100,
    '모듈은 최대 100개까지 구성할 수 있습니다.',
  )
  const nodes = new Map()
  for (const module of manifest.modules) {
    check(
      module && typeof module.id === 'string' && ID_PATTERN.test(module.id),
      '모듈 식별자가 올바르지 않습니다.',
    )
    check(!nodes.has(module.id), '모듈 식별자가 중복되었습니다.')
    validTitle(module.title)
    check(KINDS.includes(module.kind), '모듈 종류가 올바르지 않습니다.')
    check(typeof module.hidden === 'boolean', '숨김 설정이 올바르지 않습니다.')
    check(
      module.parentId === null ||
        (typeof module.parentId === 'string' &&
          ID_PATTERN.test(module.parentId)),
      '상위 모듈을 확인해 주세요.',
    )
    check(
      module.parentId === null || ['section', 'table'].includes(module.kind),
      '초록과 Highlights는 논문 최상위에 배치해 주세요.',
    )
    if (module.kind === 'table') validateTable(module.table)
    nodes.set(module.id, module)
  }
  for (const module of manifest.modules) {
    if (module.parentId !== null) {
      check(
        nodes.get(module.parentId)?.kind !== 'table',
        '표 안에는 하위 모듈을 넣을 수 없습니다.',
      )
      if (module.kind === 'table')
        check(
          nodes.get(module.parentId)?.kind === 'section',
          '표는 일반 섹션 안이나 논문 최상위에 넣어 주세요.',
        )
    }
    const seen = new Set([module.id])
    let parentId = module.parentId
    let depth = 1
    while (parentId !== null) {
      check(nodes.has(parentId), '상위 모듈이 존재하지 않습니다.')
      check(!seen.has(parentId), '자신의 하위 모듈 안으로 이동할 수 없습니다.')
      seen.add(parentId)
      parentId = nodes.get(parentId).parentId
      depth += 1
    }
    check(depth <= 3, '첫 버전은 3단계 제목 구조까지 지원합니다.')
  }
  return manifest
}

export function createManifest(title) {
  const modules = []
  function add(name, kind = 'section', parentId = null) {
    const id = randomUUID()
    modules.push({ id, title: name, kind, parentId, hidden: false })
    return id
  }
  add('Abstract', 'abstract')
  add('Introduction')
  const methods = add('Methods')
  add('Data collection', 'section', methods)
  add('Model training', 'section', methods)
  add('Results')
  add('Conclusion')
  return validateManifest({
    format: 'overleaf-lab-assembly',
    schemaVersion: 1,
    version: 1,
    title,
    modules,
  })
}

export function applyOperation(manifest, version, operation) {
  validateManifest(manifest)
  if (version !== manifest.version) {
    throw new AssemblyError(
      '다른 화면에서 구성이 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
      409,
    )
  }
  const next = structuredClone(manifest)
  const module = next.modules.find(item => item.id === operation.id)
  if (!['add', 'metadata'].includes(operation.type))
    check(module, '모듈을 찾을 수 없습니다.')

  switch (operation.type) {
    case 'add':
      next.modules.push({
        id: randomUUID(),
        title: operation.title,
        kind: operation.kind,
        parentId: operation.parentId,
        hidden: false,
        ...(operation.kind === 'table' && { table: createTable() }),
      })
      break
    case 'metadata':
      next.title = operation.title
      next.metadata = operation.metadata
      break
    case 'table':
      check(module.kind === 'table', '표 모듈을 선택해 주세요.')
      module.table = validateTable(operation.table)
      break
    case 'rename':
      module.title = operation.title
      break
    case 'visibility':
      module.hidden = operation.hidden
      break
    case 'move': {
      check(operation.beforeId !== module.id, '같은 위치로 이동할 수 없습니다.')
      module.parentId = operation.parentId
      const rest = next.modules.filter(item => item.id !== module.id)
      const before = operation.beforeId
        ? rest.find(item => item.id === operation.beforeId)
        : null
      check(
        !operation.beforeId || (before && before.parentId === module.parentId),
        '이동할 위치의 상위 모듈을 확인해 주세요.',
      )
      rest.splice(before ? rest.indexOf(before) : rest.length, 0, module)
      next.modules = rest
      break
    }
    default:
      throw new AssemblyError('지원하지 않는 조립 작업입니다.')
  }
  next.version += 1
  return validateManifest(next)
}

function visibleChildren(manifest, parentId) {
  return manifest.modules.filter(
    module => module.parentId === parentId && !module.hidden,
  )
}

export function getModuleNumbers(manifest) {
  validateManifest(manifest)
  const numbers = new Map(manifest.modules.map(module => [module.id, null]))
  let tableCount = 0
  const visit = (parentId, prefix, numbered) => {
    let count = 0
    for (const module of visibleChildren(manifest, parentId)) {
      if (module.kind === 'table') {
        numbers.set(
          module.id,
          `Table ${++tableCount}${manifest.profile ? '.' : ':'}`,
        )
        continue
      }
      const included = numbered && module.kind === 'section'
      const path = included ? [...prefix, ++count] : prefix
      if (included)
        numbers.set(module.id, path.join('.') + (manifest.profile ? '.' : ''))
      visit(module.id, path, included)
    }
  }
  visit(null, [], true)
  return numbers
}

export function renderManifest(manifest) {
  validateManifest(manifest)
  const lines =
    manifest.profile === CLEANER_PROFILE
      ? cleanerPreamble(manifest)
      : [
          '% Generated by the lab assembly editor. Edit content in the module files.',
          '\\documentclass{article}',
          '\\usepackage{graphicx}',
          '\\usepackage{amsmath}',
          `\\title{${escapeLatex(manifest.title)}}`,
          '\\author{}',
          '\\date{}',
          '\\begin{document}',
          '\\maketitle',
        ]
  if (!manifest.profile && manifest.modules.some(m => m.kind === 'table')) {
    lines.splice(
      4,
      0,
      '\\usepackage{array,booktabs,longtable,multirow,caption,setspace}',
    )
  }
  const children = parentId => visibleChildren(manifest, parentId)
  const content = module => {
    lines.push(`\\input{${moduleFilename(module.id)}}`, '\\par')
  }
  const visit = (module, depth, mode) => {
    if (module.kind === 'table') {
      content(module)
      return
    }
    if (mode === 'abstract') {
      lines.push(`\\noindent\\textbf{${escapeLatex(module.title)}}\\par`)
    } else if (mode === 'highlights') {
      lines.push('\\item')
    } else {
      lines.push(
        `\\${SECTION_COMMANDS[depth - 1]}{${escapeLatex(module.title)}}`,
        `\\label{lab:${module.id}}`,
      )
    }
    content(module)
    const descendants = children(module.id)
    if (mode === 'highlights' && descendants.length)
      lines.push('\\begin{itemize}')
    for (const child of descendants) visit(child, depth + 1, mode)
    if (mode === 'highlights' && descendants.length)
      lines.push('\\end{itemize}')
  }
  for (const module of children(null)) {
    if (module.kind === 'abstract') {
      lines.push(
        manifest.profile
          ? `\\section*{${escapeLatex(module.title)}}`
          : '\\begin{abstract}',
      )
      content(module)
      for (const child of children(module.id)) visit(child, 2, 'abstract')
      if (!manifest.profile) lines.push('\\end{abstract}')
    } else if (module.kind === 'unnumbered') {
      lines.push(`\\section*{${escapeLatex(module.title)}}`)
      content(module)
      for (const child of children(module.id)) visit(child, 2, 'abstract')
    } else if (module.kind === 'highlights') {
      if (manifest.profile) lines.push('\\clearpage')
      lines.push(`\\section*{${escapeLatex(module.title)}}`)
      content(module)
      const items = children(module.id)
      if (items.length) {
        lines.push('\\begin{itemize}')
        for (const child of items) visit(child, 2, 'highlights')
        lines.push('\\end{itemize}')
      }
    } else {
      visit(module, 1, 'section')
    }
  }
  lines.push('\\end{document}', '')
  return lines.join('\n')
}
