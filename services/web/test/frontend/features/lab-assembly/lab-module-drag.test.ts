import { expect } from 'chai'
import type { Module } from '@/features/lab-assembly/lab-assembly-widget'
import { dropMove, dropPosition } from '@/features/lab-assembly/lab-module-drag'

const module = (
  id: string,
  parentId: string | null = null,
  kind: Module['kind'] = 'section'
): Module => ({
  id,
  parentId,
  kind,
  title: id,
  hidden: false,
  number: null,
  doc: { _id: id, name: id + '.tex' }
})
describe('Module drag placement', function () {
  it('uses the top, middle and bottom of the target', function () {
    expect(dropPosition(110, 100, 80)).to.equal('before')
    expect(dropPosition(140, 100, 80)).to.equal('inside')
    expect(dropPosition(170, 100, 80)).to.equal('after')
  })
  it('places before, within or after the target without inserting before itself', function () {
    const modules = [module('a'), module('b'), module('c')]
    expect(dropMove(modules, 'c', 'a', 'before')).to.deep.equal({
      type: 'move',
      id: 'c',
      parentId: null,
      beforeId: 'a'
    })
    expect(dropMove(modules, 'c', 'a', 'inside')).to.deep.equal({
      type: 'move',
      id: 'c',
      parentId: 'a',
      beforeId: null
    })
    expect(dropMove(modules, 'c', 'a', 'after')).to.deep.equal({
      type: 'move',
      id: 'c',
      parentId: null,
      beforeId: 'b'
    })
    expect(dropMove(modules, 'b', 'a', 'after')?.beforeId).to.equal('c')
  })
  it('rejects self drops, cycles and an entire subtree exceeding the depth limit', function () {
    const modules = [
      module('a'),
      module('b', 'a'),
      module('c', 'b'),
      module('d')
    ]
    expect(dropMove(modules, 'a', 'a', 'inside')).to.equal(null)
    expect(dropMove(modules, 'a', 'c', 'inside')).to.equal(null)
    expect(dropMove(modules, 'a', 'd', 'inside')).to.equal(null)
  })
  it('keeps table and figure modules as leaves and frontmatter at root', function () {
    const modules = [
      module('a'),
      module('fig', null, 'figure'),
      module('tab', null, 'table'),
      module('abs', null, 'abstract')
    ]
    expect(dropMove(modules, 'a', 'fig', 'inside')).to.equal(null)
    expect(dropMove(modules, 'a', 'tab', 'inside')).to.equal(null)
    expect(dropMove(modules, 'abs', 'a', 'inside')).to.equal(null)
    expect(dropMove(modules, 'fig', 'a', 'inside')?.parentId).to.equal('a')
  })
})
