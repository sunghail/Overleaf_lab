import '@/utils/meta'
import '@/utils/webpack-public-path'
import '@/infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import { lazy, Suspense, useState } from 'react'
import LabAssemblyWidget from '../features/lab-assembly/lab-assembly-widget'
import { postJSON, getUserFacingMessage } from '@/infrastructure/fetch-json'
import getMeta from '@/utils/meta'

const LabPdfPreview = lazy(() => import('../features/lab-assembly/lab-pdf-preview'))

const project = getMeta('ol-project') as {
  _id: string
  name: string
  compiler: string
}
const canWrite = getMeta('ol-hasWriteAccess')
const savedContent = async () => {}
const selectModule = async () => {}
const showVisual = () => {}

function LabAssemblyWorkspace() {
  const [busy, setBusy] = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [pdf, setPdf] = useState<string | null>(null)
  const [error, setError] = useState('')
  const compile = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await postJSON<{
        status: string
        outputFiles?: { path: string; url: string }[]
      }>(`/project/${project._id}/compile`, {
        body: { compiler: project.compiler, stopOnFirstError: true }
      })
      const output = result.outputFiles?.find(f => f.path === 'output.pdf')
      if (result.status !== 'success' || !output)
        throw new Error(
          'PDF를 만들지 못했습니다. 본문 편집기의 컴파일 기록을 확인해 주세요.'
        )
      setPdf(output.url)
    } catch (e) {
      setError(getUserFacingMessage(e as Error) || (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="lab-assembly-workspace">
      <header className="lab-workspace-header">
        <div>
          <span className="lab-workspace-eyebrow">연구실 논문 작성기</span>
          <h1>논문 조립</h1>
          <p>{project.name}</p>
        </div>
        <div className="lab-workspace-actions">
          <a href="/project" className="btn btn-secondary">
            프로젝트 목록
          </a>
          <a
            href={`/project/${project._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            본문 편집기 열기
          </a>
          <button
            className="btn btn-primary"
            disabled={!canWrite || busy || assembling}
            onClick={compile}
          >
            {busy ? 'PDF 만드는 중…' : 'PDF 만들기'}
          </button>
        </div>
      </header>
      {!canWrite && (
        <p className="lab-workspace-notice">읽기 전용 원고입니다.</p>
      )}
      {error && (
        <p className="lab-workspace-notice text-danger" role="alert">
          {error}
        </p>
      )}
      {pdf && (
        <section className="lab-workspace-preview">
          <header>
            <h2>조립한 PDF</h2>
            <div>
              <a
                href={pdf}
                download={`${project.name}.pdf`}
                className="btn btn-sm btn-secondary"
              >
                PDF 다운로드
              </a>{' '}
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setPdf(null)}
              >
                미리보기 닫기
              </button>
            </div>
          </header>
          <Suspense fallback={<p role="status">PDF를 불러오는 중…</p>}>
            <LabPdfPreview key={pdf} url={pdf} />
          </Suspense>
        </section>
      )}
      <LabAssemblyWidget
        projectId={project._id}
        write={canWrite}
        isConnected
        openDoc={selectModule}
        setShowVisual={showVisual}
        waitForSavedContent={savedContent}
        onBusyChange={setAssembling}
        standalone
      />
    </div>
  )
}

const element = document.getElementById('lab-assembly-workspace-root')
if (element) createRoot(element).render(<LabAssemblyWorkspace />)
