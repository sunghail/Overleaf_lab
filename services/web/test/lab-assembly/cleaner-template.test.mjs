import test from 'node:test'
import assert from 'node:assert/strict'
import { createCleanerManifest } from '../../app/src/Features/LabAssembly/LabCleanerTemplate.mjs'
import {
  validateManifest,
  renderManifest,
  applyOperation,
  getModuleNumbers,
} from '../../app/src/Features/LabAssembly/LabAssemblyModel.mjs'
import {
  createTable,
  validateTable,
  renderTable,
} from '../../app/src/Features/LabAssembly/LabTableModel.mjs'
import { renderWordSource } from '../../app/src/Features/LabAssembly/LabWordModel.mjs'

test('Cleaner form uses measured Word typography, geometry and separate table counters', () => {
  const m = validateManifest(createCleanerManifest()),
    source = renderManifest(m),
    n = getModuleNumbers(m)
  assert.match(source, /documentclass\[12pt,a4paper\]/)
  assert.ok(source.includes('top=30mm,bottom=25.4mm,left=25.4mm,right=25.4mm'))
  assert.ok(source.includes('Times New Roman.ttf'))
  assert.ok(source.includes('\\setlength{\\parindent}{12pt}'))
  assert.ok(source.includes('\\fontsize{12}{27.6}'))
  assert.equal(n.get(m.modules.find(x => x.title === 'Introduction').id), '1.')
  assert.equal(n.get(m.modules.find(x => x.kind === 'table').id), 'Table 1.')
  assert.equal(n.get(m.modules.find(x => x.title === 'ANN model').id), '3.2.')
})
test('editable table preserves precision and escapes text while retaining math cells', () => {
  const t = createTable()
  t.cells[1][1] = '0.000012345'
  t.cells[1][5] = 'A & B_1'
  const s = renderTable(t, 'Model & coefficients', 'id')
  assert.ok(s.includes('0.000012345'))
  assert.ok(s.includes('A \\& B\\_1'))
  assert.ok(s.includes('$K_1$'))
  assert.ok(s.includes('\\toprule'))
  assert.ok(s.includes('\\endhead'))
})
test('invalid dimensions, widths and overlapping merges are rejected', () => {
  const t = createTable()
  t.columns[0].width = 0
  assert.throws(() => validateTable(t))
  const m = createTable()
  m.merges = [
    { row: 1, col: 1, rows: 1, cols: 2 },
    { row: 1, col: 2, rows: 1, cols: 2 },
  ]
  assert.throws(() => validateTable(m))
  const filled = createTable()
  filled.cells[1][2] = 'preserve'
  filled.merges = [{ row: 1, col: 1, rows: 1, cols: 2 }]
  assert.throws(() => validateTable(filled))
})
test('valid horizontal and vertical merges render once and can be reversed without changing values', () => {
  const t = createTable()
  t.cells[1][1] = 'Group'
  t.merges = [{ row: 1, col: 1, rows: 2, cols: 2 }]
  const s = renderTable(t, 'Caption', 'id')
  assert.ok(s.includes('\\multicolumn{2}'))
  assert.ok(s.includes('\\multirow{2}'))
  assert.equal(s.split('Group').length, 2)
  t.merges = []
  assert.equal(t.cells[1][1], 'Group')
  assert.equal(validateTable(t), t)
})
test('table moves and hiding do not consume heading numbers', () => {
  let m = createCleanerManifest()
  const table = m.modules.find(x => x.kind === 'table'),
    results = m.modules.find(x => x.title === 'Results and discussion')
  m = applyOperation(m, m.version, {
    type: 'move',
    id: table.id,
    parentId: results.id,
    beforeId: null,
  })
  assert.equal(getModuleNumbers(m).get(results.id), '4.')
  assert.equal(getModuleNumbers(m).get(table.id), 'Table 1.')
  m = applyOperation(m, m.version, {
    type: 'visibility',
    id: results.id,
    hidden: true,
  })
  assert.equal(getModuleNumbers(m).get(table.id), null)
})
test('table update changes only structured table data and keeps file identity', () => {
  const m = createCleanerManifest(),
    module = m.modules.find(x => x.kind === 'table'),
    table = structuredClone(module.table)
  table.cells[1][1] = '12.5'
  const next = applyOperation(m, m.version, {
    type: 'table',
    id: module.id,
    table,
  })
  assert.equal(
    next.modules.find(x => x.id === module.id).table.cells[1][1],
    '12.5',
  )
  assert.equal(module.table.cells[1][1], '')
  assert.equal(next.version, 2)
})
test('Word manuscript has the same heading numbers and native table math, while highlights are separate', () => {
  const m = createCleanerManifest(),
    word = renderWordSource(m),
    highlights = renderWordSource(m, 'highlights')
  assert.ok(word.source.includes('\\section*{1. Introduction}'))
  assert.ok(word.source.includes('\\caption{Table 1. Model coefficients}'))
  assert.ok(word.source.includes('$K_1$'))
  assert.equal(word.settings.tables.length, 1)
  assert.ok(
    !word.source.includes(m.modules.find(x => x.kind === 'highlights').id),
  )
  assert.equal(highlights.settings.tables.length, 0)
  assert.ok(!highlights.source.includes('Introduction'))
})
