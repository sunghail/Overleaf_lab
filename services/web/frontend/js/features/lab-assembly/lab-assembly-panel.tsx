import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  getJSON,
  postJSON,
  putJSON,
  getUserFacingMessage,
} from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { Doc } from '../../../../types/doc'
import LabTableEditor from './lab-table-editor'
import LabTemplatePanel from './lab-template-panel'
import getMeta from '@/utils/meta'

type Kind = 'section' | 'abstract' | 'highlights' | 'unnumbered' | 'table'
export type LabTable = {
  cells: string[][]
  math: boolean[][]
  columns: { width: number; align: 'left' | 'center' | 'right' }[]
  merges: { row: number; col: number; rows: number; cols: number }[]
  headerRows: number
  fontSize: number
  rowSpacing: number
  borders: 'academic' | 'grid' | 'none'
  notes: string
}
type Metadata = { authors: string; affiliations: string; authorNotes: string }
export type Module = {
  id: string
  title: string
  kind: Kind
  parentId: string | null
  hidden: boolean
  number: string | null
  doc: Doc
  table?: LabTable
}
type Assembly = {
  version: number
  title: string
  mainDoc: Doc
  modules: Module[]
  profile?: string
  metadata?: Metadata
}
type Operation =
  | { type: 'add'; title: string; kind: Kind; parentId: string | null }
  | { type: 'rename'; id: string; title: string }
  | { type: 'visibility'; id: string; hidden: boolean }
  | { type: 'table'; id: string; table: LabTable }
  | { type: 'metadata'; title: string; metadata: Metadata }
  | {
      type: 'move'
      id: string
      parentId: string | null
      beforeId: string | null
    }

const ROOT = ''
const moduleLabel = (module: Module) =>
  module.number ? `${module.number} ${module.title}` : module.title
const errorMessage = (error: unknown) =>
  getUserFacingMessage(error as Error) || '작업을 완료하지 못했습니다.'

export default function LabAssemblyPanel() {
  const { projectId } = useProjectContext()
  const { socket, isConnected } = useConnectionContext()
  const { write } = usePermissionsContext()
  const { openDoc, openDocs } = useEditorManagerContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { setShowVisual } = useEditorPropertiesContext()
  const [assembly, setAssembly] = useState<Assembly | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState<Kind>('section')
  const [newParent, setNewParent] = useState(ROOT)
  const [renameTitle, setRenameTitle] = useState('')
  const [moveParent, setMoveParent] = useState(ROOT)
  const [visualDoc, setVisualDoc] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [tableEditing, setTableEditing] = useState<string | null>(null)
  const selectionDoc = useRef<string | null>(null)
  const [paperTitle, setPaperTitle] = useState('')
  const [metadata, setMetadata] = useState<Metadata>({
    authors: '',
    affiliations: '',
    authorNotes: '',
  })
  const url = `/project/${projectId}/lab-assembly`
  const editable = write && isConnected && !busy
  const selected = assembly?.modules.find(module => module.id === selectedId)

  const reload = useCallback(async () => {
    try {
      setAssembly(await getJSON<Assembly | null>(url))
      setError('')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    setLoading(true)
    setAssembly(null)
    setSelectedId(null)
    reload()
  }, [reload])

  useEffect(() => {
    socket.on('labAssemblyUpdated', reload)
    return () => {
      socket.removeListener('labAssemblyUpdated', reload)
    }
  }, [socket, reload])

  useEffect(() => {
    const module = assembly?.modules.find(
      item => item.doc._id === currentDocumentId,
    )
    if (module && (selectionDoc.current !== currentDocumentId || !selectedId))
      setSelectedId(module.id)
    selectionDoc.current = currentDocumentId
  }, [assembly, currentDocumentId])

  useEffect(() => {
    setRenameTitle(selected?.title || '')
    setMoveParent(selected?.parentId || ROOT)
  }, [selected?.id, selected?.title, selected?.parentId])

  useEffect(() => {
    if (visualDoc && visualDoc === currentDocumentId) {
      setShowVisual(true)
      setVisualDoc(null)
    }
  }, [visualDoc, currentDocumentId, setShowVisual])

  useEffect(() => {
    if (assembly) {
      setPaperTitle(assembly.title)
      setMetadata(
        assembly.metadata || { authors: '', affiliations: '', authorNotes: '' },
      )
    }
  }, [assembly?.title, assembly?.metadata])

  const openModule = async (module: Module) => {
    setSelectedId(module.id)
    if (module.kind === 'table') {
      setTableEditing(module.id)
      return
    }
    try {
      await openDoc(module.doc)
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  const waitForSavedContent = async () => {
    await openDocs.awaitBufferedOps(AbortSignal.timeout(10_000))
    if (openDocs.hasUnsavedChanges()) {
      throw new Error(
        '본문 저장이 끝나지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
      )
    }
  }

  const initialize = async () => {
    setBusy(true)
    setError('')
    try {
      await waitForSavedContent()
      const result = await postJSON<Assembly>(`${url}/initialize`, { body: {} })
      setAssembly(result)
      const first = result.modules.find(module => module.kind === 'section')
      if (first) {
        await openModule(first)
        setVisualDoc(first.doc._id)
      }
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const mutate = async (operation: Operation) => {
    if (!assembly || !editable) return false
    setBusy(true)
    setError('')
    try {
      await waitForSavedContent()
      const result = await putJSON<Assembly>(url, {
        body: { version: assembly.version, operation },
      })
      setAssembly(result)
      if (operation.type === 'add') {
        const module = result.modules.find(
          item => !assembly.modules.some(old => old.id === item.id),
        )
        if (module) await openModule(module)
        setNewTitle('')
      }
      return true
    } catch (error) {
      const message = errorMessage(error)
      await reload()
      setError(message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const modules = assembly?.modules || []
  const wordDownload = async (target: 'manuscript' | 'highlights') => {
    if (!assembly || !editable) return
    setBusy(true)
    setError('')
    try {
      await waitForSavedContent()
      const response = await fetch(`${url}/word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getMeta('ol-csrfToken'),
        },
        body: JSON.stringify({ version: assembly.version, target }),
      })
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.message || 'Word 변환을 완료하지 못했습니다.')
      }
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download =
        target === 'highlights'
          ? 'Highlights.docx'
          : 'Cleaner_Production_Manuscript.docx'
      link.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const isDescendant = (id: string, ancestorId: string) => {
    let node = modules.find(item => item.id === id)
    while (node?.parentId) {
      if (node.parentId === ancestorId) return true
      node = modules.find(item => item.id === node?.parentId)
    }
    return false
  }
  const depthOf = (module: Module) => {
    let depth = 1
    let parentId = module.parentId
    while (parentId) {
      depth += 1
      parentId = modules.find(item => item.id === parentId)?.parentId || null
    }
    return depth
  }
  const effectivelyHidden = (module: Module) =>
    module.hidden ||
    modules.some(parent => parent.hidden && isDescendant(module.id, parent.id))
  const parents = modules.filter(
    module => depthOf(module) < 3 && module.kind !== 'table',
  )
  const siblings = modules.filter(
    module => module.parentId === selected?.parentId,
  )
  const selectedIndex = siblings.findIndex(module => module.id === selectedId)

  const moveSibling = (direction: -1 | 1) => {
    if (!selected) return
    const beforeId =
      direction === -1
        ? siblings[selectedIndex - 1]?.id
        : siblings[selectedIndex + 2]?.id || null
    mutate({
      type: 'move',
      id: selected.id,
      parentId: selected.parentId,
      beforeId: beforeId || null,
    })
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    mutate({
      type: 'add',
      title: newTitle.trim(),
      kind: newKind,
      parentId: newParent || null,
    })
  }

  const renderModules = (parentId: string | null): ReactNode => (
    <ul className="lab-assembly-list">
      {modules
        .filter(module => module.parentId === parentId)
        .map(module => {
          const hidden = effectivelyHidden(module)
          if (hidden && !showHidden) return null
          return (
            <li key={module.id}>
              <button
                type="button"
                className={`lab-assembly-module${selectedId === module.id ? ' selected' : ''}${hidden ? ' is-hidden' : ''}${dropId === module.id ? ' drop-target' : ''}`}
                aria-pressed={selectedId === module.id}
                aria-label={`${moduleLabel(module)} 본문 편집${hidden ? ' (숨김)' : ''}`}
                draggable={editable}
                onClick={() => openModule(module)}
                onDragStart={event => {
                  event.dataTransfer.setData(
                    'application/x-lab-module',
                    module.id,
                  )
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={event => {
                  if (
                    editable &&
                    event.dataTransfer.types.includes(
                      'application/x-lab-module',
                    )
                  ) {
                    event.preventDefault()
                    setDropId(module.id)
                  }
                }}
                onDragLeave={() => setDropId(null)}
                onDrop={event => {
                  event.preventDefault()
                  setDropId(null)
                  const id = event.dataTransfer.getData(
                    'application/x-lab-module',
                  )
                  if (id && id !== module.id) {
                    mutate({
                      type: 'move',
                      id,
                      parentId: module.parentId,
                      beforeId: module.id,
                    })
                  }
                }}
                onDragEnd={() => setDropId(null)}
              >
                <span>{moduleLabel(module)}</span>
                {hidden && <small>숨김</small>}
              </button>
              {renderModules(module.id)}
            </li>
          )
        })}
    </ul>
  )

  return (
    <section className="lab-assembly-panel" aria-label="논문 조립">
      <header>
        <h4>논문 조립</h4>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={reload}
          disabled={busy}
        >
          새로고침
        </button>
      </header>
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={() => setShowTemplates(!showTemplates)}
      >
        {showTemplates ? '작성으로 돌아가기' : '템플릿 저장·불러오기'}
      </button>
      {showTemplates && (
        <LabTemplatePanel
          projectId={projectId}
          waitForSavedContent={waitForSavedContent}
          editable={editable}
        />
      )}
      {error && (
        <p className="lab-assembly-error" role="alert">
          {error}
        </p>
      )}
      {!showTemplates &&
        (loading ? (
          <p role="status">구성을 불러오는 중…</p>
        ) : !assembly ? (
          <div className="lab-assembly-start">
            <p>섹션을 따로 작성하고 원하는 순서로 조립하세요.</p>
            <p>기존 문서를 보관하고 새 조립 문서를 만듭니다.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={initialize}
              disabled={!editable}
            >
              {busy ? '구성하는 중…' : '모듈 구성 시작'}
            </button>
          </div>
        ) : (
          <>
            {assembly.profile && (
              <details className="lab-paper-settings">
                <summary>Cleaner Production 01 · 원고 정보</summary>
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    mutate({ type: 'metadata', title: paperTitle, metadata })
                  }}
                >
                  <label>
                    논문 제목
                    <textarea
                      aria-label="논문 제목"
                      value={paperTitle}
                      maxLength={200}
                      onChange={e => setPaperTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    저자 · 소속 표시는 [a], [b,*]
                    <textarea
                      aria-label="논문 저자"
                      value={metadata.authors}
                      onChange={e =>
                        setMetadata({ ...metadata, authors: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    소속 · 한 줄에 하나
                    <textarea
                      aria-label="논문 소속"
                      value={metadata.affiliations}
                      onChange={e =>
                        setMetadata({
                          ...metadata,
                          affiliations: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    저자 주석
                    <textarea
                      aria-label="저자 주석"
                      value={metadata.authorNotes}
                      onChange={e =>
                        setMetadata({
                          ...metadata,
                          authorNotes: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={!editable}
                  >
                    원고 정보 저장
                  </button>
                </form>
                <div className="lab-assembly-buttons">
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={!editable}
                    onClick={() => wordDownload('manuscript')}
                  >
                    Word 원고 다운로드
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={!editable}
                    onClick={() => wordDownload('highlights')}
                  >
                    Highlights Word 다운로드
                  </button>
                </div>
              </details>
            )}
            <p className="lab-assembly-help">
              모듈을 클릭해 본문을 작성하세요. 끌어서 다른 모듈 앞에 놓거나 이동
              버튼으로 순서를 바꿀 수 있습니다.
            </p>
            <label className="lab-assembly-checkbox">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={event => setShowHidden(event.target.checked)}
              />{' '}
              숨긴 모듈도 보기
            </label>
            <nav aria-label="논문 모듈">{renderModules(null)}</nav>
            {selected && (
              <div className="lab-assembly-selection">
                <strong>{moduleLabel(selected)}</strong>
                {selected.kind === 'table' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!editable}
                      onClick={() => setTableEditing(selected.id)}
                    >
                      표 편집
                    </button>
                    <p className="lab-assembly-help">
                      표는 표 편집기로 수정하세요. LaTeX는 저장할 때 생성됩니다.
                    </p>
                  </>
                )}
                {effectivelyHidden(selected) && (
                  <p>이 모듈은 PDF에서 제외됩니다. 본문은 보관됩니다.</p>
                )}
                <div className="lab-assembly-buttons">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={!editable || selectedIndex <= 0}
                    onClick={() => moveSibling(-1)}
                    aria-label={`${selected.title} 위로 이동`}
                  >
                    ↑ 위로
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={!editable || selectedIndex >= siblings.length - 1}
                    onClick={() => moveSibling(1)}
                    aria-label={`${selected.title} 아래로 이동`}
                  >
                    ↓ 아래로
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={!editable}
                    onClick={() =>
                      mutate({
                        type: 'visibility',
                        id: selected.id,
                        hidden: !selected.hidden,
                      })
                    }
                  >
                    {selected.hidden ? '복원' : '숨기기'}
                  </button>
                </div>
                <form
                  onSubmit={event => {
                    event.preventDefault()
                    mutate({
                      type: 'rename',
                      id: selected.id,
                      title: renameTitle.trim(),
                    })
                  }}
                >
                  <label htmlFor="lab-module-rename">모듈 제목</label>
                  <div className="lab-assembly-inline">
                    <input
                      id="lab-module-rename"
                      value={renameTitle}
                      maxLength={200}
                      onChange={event => setRenameTitle(event.target.value)}
                      disabled={!editable}
                    />
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={!editable || !renameTitle.trim()}
                    >
                      변경
                    </button>
                  </div>
                </form>
                {['section', 'table'].includes(selected.kind) && (
                  <form
                    onSubmit={event => {
                      event.preventDefault()
                      mutate({
                        type: 'move',
                        id: selected.id,
                        parentId: moveParent || null,
                        beforeId: null,
                      })
                    }}
                  >
                    <label htmlFor="lab-module-parent">상위 모듈</label>
                    <div className="lab-assembly-inline">
                      <select
                        id="lab-module-parent"
                        value={moveParent}
                        onChange={event => setMoveParent(event.target.value)}
                        disabled={!editable}
                      >
                        <option value={ROOT}>논문 최상위</option>
                        {parents
                          .filter(
                            module =>
                              (selected.kind !== 'table' ||
                                module.kind === 'section') &&
                              module.id !== selected.id &&
                              !isDescendant(module.id, selected.id),
                          )
                          .map(module => (
                            <option key={module.id} value={module.id}>
                              {moduleLabel(module)}
                            </option>
                          ))}
                      </select>
                      <button
                        className="btn btn-sm btn-secondary"
                        disabled={!editable}
                      >
                        이동
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            <form className="lab-assembly-add" onSubmit={add}>
              <h5>모듈 추가</h5>
              <label htmlFor="lab-new-title">제목</label>
              <input
                id="lab-new-title"
                value={newTitle}
                maxLength={200}
                onChange={event => setNewTitle(event.target.value)}
                disabled={!editable}
                placeholder="예: Experimental setup"
                required
              />
              <label htmlFor="lab-new-kind">종류</label>
              <select
                id="lab-new-kind"
                value={newKind}
                onChange={event => {
                  setNewKind(event.target.value as Kind)
                  setNewParent(ROOT)
                }}
                disabled={!editable}
              >
                <option value="section">일반 섹션</option>
                <option value="abstract">초록</option>
                <option value="highlights">Highlights</option>
                <option value="unnumbered">번호 없는 구성</option>
                <option value="table">계수표 01</option>
              </select>
              <label htmlFor="lab-new-parent">넣을 위치</label>
              <select
                id="lab-new-parent"
                value={newParent}
                onChange={event => setNewParent(event.target.value)}
                disabled={!editable || !['section', 'table'].includes(newKind)}
              >
                <option value={ROOT}>논문 최상위</option>
                {parents
                  .filter(m => newKind !== 'table' || m.kind === 'section')
                  .map(module => (
                    <option key={module.id} value={module.id}>
                      {moduleLabel(module)} 안
                    </option>
                  ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={!editable || !newTitle.trim()}
              >
                추가하고 작성
              </button>
            </form>
            <p className="lab-assembly-help" role="status">
              {busy
                ? '구성을 저장하는 중…'
                : `구성 저장됨 · 버전 ${assembly.version}`}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => openDoc(assembly.mainDoc)}
            >
              조립 LaTeX 보기
            </button>
            <p className="lab-assembly-help">
              조립 LaTeX는 자동 생성됩니다. 본문은 모듈을 선택해 편집하세요.
            </p>
          </>
        ))}
      {tableEditing && modules.find(m => m.id === tableEditing)?.table && (
        <LabTableEditor
          key={tableEditing}
          module={modules.find(m => m.id === tableEditing)!}
          onClose={() => setTableEditing(null)}
          onApply={table => mutate({ type: 'table', id: tableEditing, table })}
          error={error}
        />
      )}
    </section>
  )
}
