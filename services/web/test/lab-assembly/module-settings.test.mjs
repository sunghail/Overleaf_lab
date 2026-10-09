import test from 'node:test'
import assert from 'node:assert/strict'
import { createManifest, applyOperation, getModuleNumbers, renderManifest, moduleFilename } from '../../app/src/Features/LabAssembly/LabAssemblyModel.mjs'
import { createCleanerManifest } from '../../app/src/Features/LabAssembly/LabCleanerTemplate.mjs'
import { renderTable, createTable } from '../../app/src/Features/LabAssembly/LabTableModel.mjs'
import { validateFigure } from '../../app/src/Features/LabAssembly/LabFigureModel.mjs'
import { renderWordSource } from '../../app/src/Features/LabAssembly/LabWordModel.mjs'

test('turning a section number off keeps content and suppresses descendant title numbers', () => {
  const old = createManifest('Example'), methods = old.modules.find(m => m.title === 'Methods')
  const next = applyOperation(old, old.version, { type: 'numbering', id: methods.id, numbered: false })
  const numbers = getModuleNumbers(next), source = renderManifest(next)
  assert.equal(numbers.get(methods.id), null)
  assert.equal(numbers.get(next.modules.find(m => m.title === 'Data collection').id), null)
  assert.equal(numbers.get(next.modules.find(m => m.title === 'Results').id), '2')
  assert.ok(source.includes('\\section*{Methods}'))
  assert.ok(source.includes('\\subsection*{Data collection}'))
  assert.ok(source.includes(moduleFilename(methods.id)))
  const restored = applyOperation(next, next.version, { type: 'numbering', id: methods.id, numbered: true })
  assert.equal(renderManifest(restored), renderManifest(old))
})

test('figure roles keep file identity and use a separate visible caption counter', () => {
  const old = createManifest('Example'), intro = old.modules.find(m => m.title === 'Introduction')
  let next = applyOperation(old, old.version, { type: 'role', id: intro.id, kind: 'figure' })
  assert.equal(moduleFilename(next.modules.find(m => m.id === intro.id).id), moduleFilename(intro.id))
  assert.equal(getModuleNumbers(next).get(intro.id), 'Figure 1:')
  assert.equal(getModuleNumbers(next).get(next.modules.find(m => m.title === 'Methods').id), '1')
  next = applyOperation(next, next.version, { type: 'figure', id: intro.id, figure: { path: 'images/plot_1.png', width: 60 } })
  assert.ok(renderManifest(next).includes('width=0.6\\linewidth'))
  assert.ok(renderWordSource(next).source.includes('Figure 1: Introduction'))
  next = applyOperation(next, next.version, { type: 'numbering', id: intro.id, numbered: false })
  assert.equal(getModuleNumbers(next).get(intro.id), null)
  assert.ok(renderManifest(next).includes('\\caption*{Introduction}'))
  assert.ok(!renderWordSource(next).source.includes('null Introduction'))
})

test('caption switches preserve table values and do not consume numbers when off', () => {
  let m = createCleanerManifest(), table = m.modules.find(x => x.kind === 'table')
  m = applyOperation(m, m.version, { type: 'numbering', id: table.id, numbered: false })
  m = applyOperation(m, m.version, { type: 'add', title: 'Second table', kind: 'table', parentId: null })
  assert.equal(getModuleNumbers(m).get(table.id), null)
  assert.equal(getModuleNumbers(m).get(m.modules.at(-1).id), 'Table 1.')
  assert.ok(renderTable(createTable(), 'Caption', table.id, { numbered: false }).includes('\\caption*{Caption}'))
  assert.ok(!renderWordSource(m).source.includes('null Model coefficients'))
})

test('role changes reject leaf parents and table data conversions without modifying the original', () => {
  const m = createCleanerManifest(), parent = m.modules.find(x => x.title === 'Experiments'), table = m.modules.find(x => x.kind === 'table')
  assert.throws(() => applyOperation(m, m.version, { type: 'role', id: parent.id, kind: 'figure' }))
  assert.throws(() => applyOperation(m, m.version, { type: 'role', id: table.id, kind: 'section' }))
  assert.equal(parent.kind, 'section')
  assert.equal(table.kind, 'table')
  assert.equal(m.version, 1)
})

test('unnumbered roles can be placed under sections while special frontmatter remains at root', () => {
  const m = createManifest('Example'), child = m.modules.find(x => x.title === 'Data collection')
  const next = applyOperation(m, m.version, { type: 'role', id: child.id, kind: 'unnumbered' })
  assert.equal(getModuleNumbers(next).get(child.id), null)
  assert.ok(renderManifest(next).includes('\\subsection*{Data collection}'))
  assert.throws(() => applyOperation(m, m.version, { type: 'role', id: child.id, kind: 'abstract' }))
})

test('figure settings reject traversal, source injection, non-image files and invalid widths', () => {
  for (const path of ['../secret.png', '/private.png', 'a%evil.png', 'a}evil.png', 'notes.tex'])
    assert.throws(() => validateFigure({ path, width: 80 }))
  assert.throws(() => validateFigure({ path: 'plot.png', width: NaN }))
  assert.throws(() => validateFigure({ path: 'plot.png', width: 200 }))
  assert.deepEqual(validateFigure({ path: 'images/plot_1.png', width: 80 }), { path: 'images/plot_1.png', width: 80 })
})
