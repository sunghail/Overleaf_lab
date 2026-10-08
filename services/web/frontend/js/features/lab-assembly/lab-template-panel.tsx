import { useEffect, useState } from 'react'
import {
  getJSON,
  postJSON,
  getUserFacingMessage
} from '@/infrastructure/fetch-json'
export default function LabTemplatePanel({
  projectId,
  waitForSavedContent,
  editable,
  openInWorkspace = false
}: {
  projectId: string
  waitForSavedContent: () => Promise<void>
  editable: boolean
  openInWorkspace?: boolean
}) {
  const [library, setLibrary] = useState<{
    builtin: { id: string; name: string; description: string }[]
    saved: { _id: string; labTemplateName: string }[]
  } | null>(null)
  const [name, setName] = useState('Cleaner Production 원고')
  const [templateName, setTemplateName] = useState('내 논문 템플릿')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const reload = async () => {
    try {
      setLibrary(await getJSON('/lab-templates'))
    } catch (e) {
      setError(
        getUserFacingMessage(e as Error) || '템플릿을 불러오지 못했습니다.'
      )
    }
  }
  useEffect(() => {
    reload()
  }, [])
  const create = async (templateId: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await postJSON<{ projectId: string }>(
        '/lab-templates/create',
        { body: { templateId, name } }
      )
      window.location.assign(
        `/project/${result.projectId}${openInWorkspace ? '/lab-assembly/workspace' : ''}`
      )
    } catch (e) {
      setError(getUserFacingMessage(e as Error) || '원고를 만들지 못했습니다.')
      setBusy(false)
    }
  }
  return (
    <div className="lab-template-panel">
      <h5>템플릿으로 새 원고 만들기</h5>
      <label>
        새 프로젝트 이름
        <input
          aria-label="템플릿으로 만들 프로젝트 이름"
          value={name}
          maxLength={200}
          onChange={e => setName(e.target.value)}
        />
      </label>
      {library?.builtin.map(t => (
        <div className="lab-template-card" key={t.id}>
          <strong>{t.name}</strong>
          <p>{t.description}</p>
          <button
            className="btn btn-primary"
            disabled={busy || !name.trim()}
            onClick={() => create(t.id)}
          >
            템플릿 01 사용
          </button>
        </div>
      ))}
      <h5>저장한 개인 템플릿</h5>
      {library?.saved.length === 0 && (
        <p>현재 원고를 아래에서 저장하면 다시 사용할 수 있습니다.</p>
      )}
      {library?.saved.map(t => (
        <div className="lab-template-card" key={t._id}>
          <strong>{t.labTemplateName}</strong>
          <button
            className="btn btn-sm btn-secondary"
            disabled={busy || !name.trim()}
            onClick={() => create(t._id)}
          >
            이 템플릿으로 만들기
          </button>
        </div>
      ))}
      <h5>현재 원고를 템플릿으로 저장</h5>
      <p>본문·표·파일을 별도 템플릿 프로젝트에 보관합니다.</p>
      <label>
        템플릿 이름
        <input
          aria-label="저장할 템플릿 이름"
          value={templateName}
          maxLength={200}
          onChange={e => setTemplateName(e.target.value)}
        />
      </label>
      <button
        className="btn btn-secondary"
        disabled={!editable || busy || !templateName.trim()}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            await waitForSavedContent()
            await postJSON(`/project/${projectId}/lab-assembly/template`, {
              body: { name: templateName }
            })
            setMessage('개인 템플릿으로 저장했습니다.')
            await reload()
          } catch (e) {
            setError(
              getUserFacingMessage(e as Error) ||
                '템플릿을 저장하지 못했습니다.'
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        현재 원고 저장
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
