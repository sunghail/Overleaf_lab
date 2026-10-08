import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LabAssemblyWidget, {
  Assembly
} from '@/features/lab-assembly/lab-assembly-widget'
import { createTable } from '../../../../app/src/Features/LabAssembly/LabTableModel.mjs'

const projectId = '000000000000000000000001'
const assembly: Assembly = {
  version: 1,
  title: 'Example manuscript',
  mainDoc: { _id: 'main-document', name: 'lab-assembled.tex' },
  modules: [
    {
      id: 'introduction',
      kind: 'section',
      title: 'Introduction',
      parentId: null,
      hidden: false,
      number: '1',
      doc: { _id: 'intro-document', name: 'intro.tex' }
    },
    {
      id: 'table',
      kind: 'table',
      title: 'Coefficients',
      parentId: 'introduction',
      hidden: false,
      number: 'Table 1.',
      doc: { _id: 'table-document', name: 'table.tex' },
      table: createTable()
    }
  ]
}

describe('Lab assembly widget hosts', function () {
  beforeEach(function () {
    fetchMock.get(`/project/${projectId}/lab-assembly`, assembly)
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
  })
  function host(standalone: boolean, write = true) {
    const openDoc = sinon.stub().resolves()
    render(
      <LabAssemblyWidget
        projectId={projectId}
        write={write}
        isConnected
        openDoc={openDoc}
        setShowVisual={() => {}}
        waitForSavedContent={async () => {}}
        standalone={standalone}
      />
    )
    return openDoc
  }

  it('works without editor providers and links the selected module to its document', async function () {
    host(true)
    await userEvent.click(
      await screen.findByRole('button', { name: '1 Introduction 본문 편집' })
    )
    expect(
      screen
        .getByRole('link', { name: '이 모듈 본문 편집' })
        .getAttribute('href')
    ).to.equal(`/project/${projectId}?doc=intro-document`)
    expect(screen.getByText('구성 저장됨 · 버전 1')).to.exist
  })

  it('still opens the same document when hosted in the existing editor', async function () {
    const openDoc = host(false)
    await userEvent.click(
      await screen.findByRole('button', { name: '1 Introduction 본문 편집' })
    )
    expect(openDoc).to.have.been.calledWith(assembly.modules[0].doc)
    expect(screen.queryByRole('link', { name: '이 모듈 본문 편집' })).to.equal(
      null
    )
  })

  it('shows read-only tables without allowing a save or changing document contents', async function () {
    const openDoc = host(true, false)
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Table 1. Coefficients 본문 편집'
      })
    )
    expect(
      (screen.getByRole('button', { name: '표 저장' }) as HTMLButtonElement)
        .disabled
    ).to.equal(true)
    expect(screen.getByText('이 표는 읽기 전용입니다.')).to.exist
    expect(openDoc).not.to.have.been.called
    expect(
      fetchMock.callHistory.calls().filter(c => c.options.method === 'PUT')
    ).to.have.length(0)
  })
})
