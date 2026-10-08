import { useCallback } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import LabAssemblyWidget from './lab-assembly-widget'

export default function LabAssemblyPanel() {
  const { projectId } = useProjectContext()
  const { socket, isConnected } = useConnectionContext()
  const { write } = usePermissionsContext()
  const { openDoc, openDocs } = useEditorManagerContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { setShowVisual } = useEditorPropertiesContext()
  const subscribeToUpdates = useCallback(
    (reload: () => void) => {
      socket.on('labAssemblyUpdated', reload)
      return () => socket.removeListener('labAssemblyUpdated', reload)
    },
    [socket]
  )
  const waitForSavedContent = useCallback(async () => {
    await openDocs.awaitBufferedOps(AbortSignal.timeout(10_000))
    if (openDocs.hasUnsavedChanges()) {
      throw new Error(
        '본문 저장이 끝나지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요.'
      )
    }
  }, [openDocs])
  return (
    <div className="lab-assembly-panel-host">
      <a
        className="lab-assembly-workspace-link"
        href={`/project/${projectId}/lab-assembly/workspace`}
        target="_blank"
        rel="noopener noreferrer"
      >
        조립 전용 화면 열기 ↗
      </a>
      <LabAssemblyWidget
        projectId={projectId}
        write={write}
        isConnected={isConnected}
        openDoc={openDoc}
        currentDocumentId={currentDocumentId}
        setShowVisual={setShowVisual}
        waitForSavedContent={waitForSavedContent}
        subscribeToUpdates={subscribeToUpdates}
      />
    </div>
  )
}
