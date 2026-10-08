import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  AssemblyError,
  createManifest,
  validateManifest,
  applyOperation,
  renderManifest,
  getModuleNumbers,
  moduleFilename,
  escapeLatex,
} from '../../app/src/Features/LabAssembly/LabAssemblyModel.mjs'

function find(manifest, title) {
  return manifest.modules.find(module => module.title === title)
}

test('module numbers match the three numbered article heading levels', () => {
  let manifest = createManifest('Paper')
  manifest = applyOperation(manifest, 1, {
    type: 'add',
    title: 'Sampling',
    kind: 'section',
    parentId: find(manifest, 'Data collection').id,
  })
  const numbers = getModuleNumbers(manifest)
  const number = title => numbers.get(find(manifest, title).id)
  assert.equal(number('Abstract'), null)
  assert.equal(number('Introduction'), '1')
  assert.equal(number('Methods'), '2')
  assert.equal(number('Data collection'), '2.1')
  assert.equal(number('Sampling'), '2.1.1')
  assert.equal(number('Model training'), '2.2')
  assert.equal(number('Results'), '3')
  assert.equal(number('Conclusion'), '4')
})

test('numbers follow sibling reorder and reparenting without changing titles', () => {
  let manifest = createManifest('Paper')
  const data = find(manifest, 'Data collection')
  const training = find(manifest, 'Model training')
  manifest = applyOperation(manifest, 1, {
    type: 'move',
    id: training.id,
    parentId: data.parentId,
    beforeId: data.id,
  })
  let numbers = getModuleNumbers(manifest)
  assert.equal(numbers.get(training.id), '2.1')
  assert.equal(numbers.get(data.id), '2.2')
  manifest = applyOperation(manifest, 2, {
    type: 'move',
    id: data.id,
    parentId: find(manifest, 'Results').id,
    beforeId: null,
  })
  numbers = getModuleNumbers(manifest)
  assert.equal(numbers.get(data.id), '3.1')
  assert.equal(find(manifest, 'Data collection').title, data.title)
})

test('hidden modules and descendants consume no numbers, and restoration renumbers them', () => {
  let manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  const data = find(manifest, 'Data collection')
  const training = find(manifest, 'Model training')
  manifest = applyOperation(manifest, 1, {
    type: 'visibility',
    id: data.id,
    hidden: true,
  })
  assert.equal(getModuleNumbers(manifest).get(training.id), '2.1')
  manifest = applyOperation(manifest, 2, {
    type: 'visibility',
    id: methods.id,
    hidden: true,
  })
  const numbers = getModuleNumbers(manifest)
  assert.equal(numbers.get(methods.id), null)
  assert.equal(numbers.get(data.id), null)
  assert.equal(numbers.get(training.id), null)
  assert.equal(numbers.get(find(manifest, 'Results').id), '2')
  manifest = applyOperation(manifest, 3, {
    type: 'visibility',
    id: methods.id,
    hidden: false,
  })
  assert.equal(getModuleNumbers(manifest).get(methods.id), '2')
  assert.equal(getModuleNumbers(manifest).get(training.id), '2.1')
  assert.equal(getModuleNumbers(manifest).get(data.id), null)
})

test('abstract and highlights subtrees stay unnumbered regardless of their position', () => {
  let manifest = createManifest('Paper')
  const data = find(manifest, 'Data collection')
  manifest = applyOperation(manifest, 1, {
    type: 'move',
    id: data.id,
    parentId: find(manifest, 'Abstract').id,
    beforeId: null,
  })
  manifest = applyOperation(manifest, 2, {
    type: 'add',
    title: 'Highlights',
    kind: 'highlights',
    parentId: null,
  })
  const highlights = find(manifest, 'Highlights')
  manifest = applyOperation(manifest, 3, {
    type: 'move',
    id: highlights.id,
    parentId: null,
    beforeId: find(manifest, 'Introduction').id,
  })
  const training = find(manifest, 'Model training')
  manifest = applyOperation(manifest, 4, {
    type: 'move',
    id: training.id,
    parentId: highlights.id,
    beforeId: null,
  })
  const numbers = getModuleNumbers(manifest)
  assert.equal(numbers.get(data.id), null)
  assert.equal(numbers.get(highlights.id), null)
  assert.equal(numbers.get(training.id), null)
  assert.equal(numbers.get(find(manifest, 'Introduction').id), '1')
  assert.equal(numbers.get(find(manifest, 'Methods').id), '2')
})

test('initial structure has unique files, typed abstract, and nested methods', () => {
  const manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  assert.equal(manifest.modules.length, 7)
  assert.equal(
    new Set(manifest.modules.map(module => moduleFilename(module.id))).size,
    7,
  )
  assert.equal(find(manifest, 'Abstract').kind, 'abstract')
  assert.equal(find(manifest, 'Data collection').parentId, methods.id)
  assert.equal(find(manifest, 'Model training').parentId, methods.id)
})

test('rendered headings follow hierarchy and abstract is unnumbered', () => {
  const manifest = createManifest('Paper')
  const source = renderManifest(manifest)
  assert.match(source, /\\begin\{abstract\}/)
  assert.doesNotMatch(source, /\\section\{Abstract\}/)
  assert.match(source, /\\section\{Methods\}/)
  assert.match(source, /\\subsection\{Data collection\}/)
  assert.match(source, /\\subsection\{Model training\}/)
  assert.ok(
    source.indexOf('Data collection') < source.indexOf('Model training'),
  )
})

test('titles cannot inject LaTeX commands or turn the remainder into a comment', () => {
  const manifest = createManifest('Study & results: 50%_A')
  manifest.modules[1].title = '\\input{private} #$^~'
  const source = renderManifest(manifest)
  assert.ok(source.includes('\\title{Study \\& results: 50\\%\\_A}'))
  assert.ok(source.includes('\\textbackslash{}input\\{private\\}'))
  assert.doesNotMatch(source, /\\section\{\\input\{private/)
  assert.equal(escapeLatex('A\nB'), 'A B')
})

test('hiding a parent excludes all descendants without removing their files or structure', () => {
  const manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  const hidden = applyOperation(manifest, 1, {
    type: 'visibility',
    id: methods.id,
    hidden: true,
  })
  assert.equal(hidden.modules.length, manifest.modules.length)
  assert.equal(find(hidden, 'Data collection').parentId, methods.id)
  assert.doesNotMatch(
    renderManifest(hidden),
    /Data collection|Model training|\\section\{Methods\}/,
  )
  assert.ok(renderManifest(hidden).includes('\\section{Results}'))
  const restored = applyOperation(hidden, 2, {
    type: 'visibility',
    id: methods.id,
    hidden: false,
  })
  assert.equal(renderManifest(restored), renderManifest(manifest))
  assert.equal(methods.hidden, false)
})

test('restoring a parent preserves a separately hidden child', () => {
  let manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  const child = find(manifest, 'Model training')
  manifest = applyOperation(manifest, 1, {
    type: 'visibility',
    id: child.id,
    hidden: true,
  })
  manifest = applyOperation(manifest, 2, {
    type: 'visibility',
    id: methods.id,
    hidden: true,
  })
  manifest = applyOperation(manifest, 3, {
    type: 'visibility',
    id: methods.id,
    hidden: false,
  })
  assert.match(renderManifest(manifest), /Data collection/)
  assert.doesNotMatch(renderManifest(manifest), /Model training/)
})

test('renaming keeps content filename and stable reference label', () => {
  const manifest = createManifest('Paper')
  const module = find(manifest, 'Model training')
  const next = applyOperation(manifest, 1, {
    type: 'rename',
    id: module.id,
    title: 'Training & validation',
  })
  assert.ok(
    renderManifest(next).includes(`\\input{${moduleFilename(module.id)}}`),
  )
  assert.ok(renderManifest(next).includes(`\\label{lab:${module.id}}`))
  assert.ok(
    renderManifest(next).includes('\\subsection{Training \\& validation}'),
  )
  assert.equal(module.title, 'Model training')
})

test('moving a parent keeps its children together in the output', () => {
  const manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  const intro = find(manifest, 'Introduction')
  const next = applyOperation(manifest, 1, {
    type: 'move',
    id: methods.id,
    parentId: null,
    beforeId: intro.id,
  })
  const source = renderManifest(next)
  assert.ok(source.indexOf('Methods') < source.indexOf('Data collection'))
  assert.ok(source.indexOf('Model training') < source.indexOf('Introduction'))
})

test('moving a child to the root updates heading depth and preserves identity', () => {
  const manifest = createManifest('Paper')
  const child = find(manifest, 'Data collection')
  const next = applyOperation(manifest, 1, {
    type: 'move',
    id: child.id,
    parentId: null,
    beforeId: null,
  })
  const source = renderManifest(next)
  assert.ok(source.includes('\\section{Data collection}'))
  assert.ok(source.includes(`\\label{lab:${child.id}}`))
  assert.ok(source.includes(moduleFilename(child.id)))
})

test('sibling reordering changes input order', () => {
  const manifest = createManifest('Paper')
  const first = find(manifest, 'Data collection')
  const second = find(manifest, 'Model training')
  const next = applyOperation(manifest, 1, {
    type: 'move',
    id: second.id,
    parentId: first.parentId,
    beforeId: first.id,
  })
  const source = renderManifest(next)
  assert.ok(
    source.indexOf(moduleFilename(second.id)) <
      source.indexOf(moduleFilename(first.id)),
  )
})

test('stale structural writes are rejected without changing the previous structure', () => {
  const manifest = createManifest('Paper')
  const original = JSON.stringify(manifest)
  assert.throws(
    () =>
      applyOperation(manifest, 0, {
        type: 'rename',
        id: manifest.modules[0].id,
        title: 'Lost update',
      }),
    error => error instanceof AssemblyError && error.status === 409,
  )
  assert.equal(JSON.stringify(manifest), original)
})

test('a module cannot be moved into its own subtree', () => {
  const manifest = createManifest('Paper')
  const methods = find(manifest, 'Methods')
  const child = find(manifest, 'Data collection')
  assert.throws(
    () =>
      applyOperation(manifest, 1, {
        type: 'move',
        id: methods.id,
        parentId: child.id,
        beforeId: null,
      }),
    AssemblyError,
  )
})

test('invalid parents and cross-parent insertion targets are rejected', () => {
  const manifest = createManifest('Paper')
  const child = find(manifest, 'Data collection')
  const intro = find(manifest, 'Introduction')
  assert.throws(
    () =>
      applyOperation(manifest, 1, {
        type: 'move',
        id: child.id,
        parentId: randomUUID(),
        beforeId: null,
      }),
    AssemblyError,
  )
  assert.throws(
    () =>
      applyOperation(manifest, 1, {
        type: 'move',
        id: child.id,
        parentId: child.parentId,
        beforeId: intro.id,
      }),
    AssemblyError,
  )
})

test('three-level headings render; unsupported depth is rejected', () => {
  let manifest = createManifest('Paper')
  const parent = find(manifest, 'Data collection')
  manifest = applyOperation(manifest, 1, {
    type: 'add',
    title: 'Sampling',
    kind: 'section',
    parentId: parent.id,
  })
  assert.match(renderManifest(manifest), /\\subsubsection\{Sampling\}/)
  const deepest = find(manifest, 'Sampling')
  assert.throws(
    () =>
      applyOperation(manifest, 2, {
        type: 'add',
        title: 'Too deep',
        kind: 'section',
        parentId: deepest.id,
      }),
    AssemblyError,
  )
})

test('abstract subsections are rendered without section numbering', () => {
  let manifest = createManifest('Paper')
  const abstract = find(manifest, 'Abstract')
  manifest = applyOperation(manifest, 1, {
    type: 'add',
    title: 'Objective',
    kind: 'section',
    parentId: abstract.id,
  })
  const source = renderManifest(manifest)
  assert.ok(source.includes('\\textbf{Objective}'))
  assert.doesNotMatch(source, /\\subsection\{Objective\}/)
})

test('highlights with no items remain compilable and children use bullets', () => {
  let manifest = createManifest('Paper')
  manifest = applyOperation(manifest, 1, {
    type: 'add',
    title: 'Highlights',
    kind: 'highlights',
    parentId: null,
  })
  assert.doesNotMatch(renderManifest(manifest), /\\begin\{itemize\}/)
  const highlights = find(manifest, 'Highlights')
  manifest = applyOperation(manifest, 2, {
    type: 'add',
    title: 'Finding 1',
    kind: 'section',
    parentId: highlights.id,
  })
  const source = renderManifest(manifest)
  assert.ok(source.includes('\\begin{itemize}\n\\item'))
  assert.doesNotMatch(source, /\\subsection\{Finding 1\}/)
})

test('duplicate identifiers, malformed metadata, and path injection are rejected', () => {
  const manifest = createManifest('Paper')
  const duplicate = structuredClone(manifest)
  duplicate.modules.push(duplicate.modules[0])
  assert.throws(() => validateManifest(duplicate), AssemblyError)
  assert.throws(
    () => validateManifest({ ...manifest, schemaVersion: 99 }),
    AssemblyError,
  )
  assert.throws(() => moduleFilename('../private'), AssemblyError)
  const malformed = structuredClone(manifest)
  malformed.modules[0].id = { toString: 'invalid' }
  assert.throws(() => validateManifest(malformed), AssemblyError)
})
