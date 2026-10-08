import {
  validateManifest,
  moduleFilename,
  getModuleNumbers,
} from './LabAssemblyModel.mjs'
import { escapeLatex } from './LabLatex.mjs'
import { superscripts } from './LabCleanerTemplate.mjs'
import { renderTable } from './LabTableModel.mjs'
export function renderWordSource(manifest, target = 'manuscript') {
  validateManifest(manifest)
  const numbers = getModuleNumbers(manifest)
  const meta = manifest.metadata || {
    authors: '',
    affiliations: '',
    authorNotes: '',
  }
  const lines = [
    '\\documentclass{article}',
    `\\title{${target === 'highlights' ? 'Highlights' : manifest.title.split('\n').map(escapeLatex).join('\\\\ ')}}`,
    `\\author{${target === 'highlights' ? '' : superscripts(meta.authors)}}`,
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
  ]
  const tables = []
  const visit = (m, depth = 1) => {
    if (m.kind === 'table') {
      tables.push({ ...m.table, caption: `${numbers.get(m.id)} ${m.title}` })
      lines.push(
        renderTable(m.table, `${numbers.get(m.id)} ${m.title}`, m.id, {
          word: true,
        }),
      )
      return
    }
    if (target !== 'highlights' && depth <= 3)
      lines.push(
        `\\${['section', 'subsection', 'subsubsection'][depth - 1]}*{${escapeLatex((numbers.get(m.id) ? numbers.get(m.id) + ' ' : '') + m.title)}}`,
      )
    lines.push(`\\input{${moduleFilename(m.id)}}`, '\\par')
    for (const child of manifest.modules.filter(
      c => c.parentId === m.id && !c.hidden,
    ))
      visit(child, depth + 1)
  }
  if (target !== 'highlights') {
    meta.affiliations
      .split('\n')
      .filter(Boolean)
      .forEach((s, i) =>
        lines.push(
          `\\textsuperscript{${String.fromCharCode(97 + i)}} ${escapeLatex(s)}\\par`,
        ),
      )
    if (meta.authorNotes)
      for (const note of meta.authorNotes.split('\n'))
        lines.push(superscripts(note), '\\par')
  }
  for (const module of manifest.modules.filter(
    m =>
      m.parentId === null &&
      !m.hidden &&
      (target === 'highlights'
        ? m.kind === 'highlights'
        : m.kind !== 'highlights'),
  ))
    visit(module)
  lines.push('\\end{document}', '')
  return { source: lines.join('\n'), settings: { tables } }
}
