import ProjectGetter from '../Project/ProjectGetter.mjs'
import EditorController from '../Editor/EditorController.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import { fileURLToPath } from 'node:url'
import {
  CLEANER_PROFILE,
  REFERENCE_DOCX,
  createCleanerManifest,
  initialCleanerBody,
} from './LabCleanerTemplate.mjs'
import { renderTable } from './LabTableModel.mjs'
import { renderWordSource } from './LabWordModel.mjs'
import { isFigurePath } from './LabFigureModel.mjs'
import {
  AssemblyError,
  MANIFEST_NAME,
  MAIN_NAME,
  createManifest,
  validateManifest,
  moduleFilename,
  renderManifest,
  getModuleNumbers,
  applyOperation,
} from './LabAssemblyModel.mjs'

const lock = LockManager.withTimeout(60)
const LOCK_NAMESPACE = 'labAssemblyUpdate'

async function getProject(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: 1,
    rootFolder: 1,
    rootDoc_id: 1,
  })
  if (!project) throw new AssemblyError('프로젝트를 찾을 수 없습니다.', 404)
  return project
}

function findDoc(project, name) {
  return project.rootFolder[0].docs.find(doc => doc.name === name)
}

async function readDoc(projectId, doc) {
  if (!doc) {
    throw new AssemblyError(
      '조립에 필요한 파일이 없습니다. 파일 이력에서 복원해 주세요.',
      409,
    )
  }
  return await DocumentUpdaterHandler.promises.getDocument(
    projectId,
    doc._id,
    -1,
  )
}

async function readManifest(projectId, project) {
  const doc = findDoc(project, MANIFEST_NAME)
  if (!doc) return null
  const { lines } = await readDoc(projectId, doc)
  let manifest
  try {
    manifest = JSON.parse(lines.join('\n'))
  } catch {
    throw new AssemblyError(
      '조립 설정 파일을 읽을 수 없습니다. 파일 이력에서 복원해 주세요.',
      409,
    )
  }
  return validateManifest(manifest)
}

function serialize(project, manifest) {
  if (!manifest) return null
  const mainDoc = findDoc(project, MAIN_NAME)
  if (!mainDoc) throw new AssemblyError('조립 문서 파일을 복원해 주세요.', 409)
  const numbers = getModuleNumbers(manifest)
  return {
    version: manifest.version,
    title: manifest.title,
    profile: manifest.profile,
    metadata: manifest.metadata,
    imageFiles: imageFiles(project),
    mainDoc: { _id: mainDoc._id.toString(), name: mainDoc.name },
    modules: manifest.modules.map(module => {
      const doc = findDoc(project, moduleFilename(module.id))
      if (!doc)
        throw new AssemblyError(
          `“${module.title}”의 본문 파일을 복원해 주세요.`,
          409,
        )
      return {
        ...module,
        number: numbers.get(module.id),
        doc: { _id: doc._id.toString(), name: doc.name },
      }
    }),
  }
}

function imageFiles(project) {
  const paths = []
  const visit = (folder, prefix) => {
    for (const file of folder.fileRefs || []) {
      const path = prefix + file.name
      if (isFigurePath(path)) paths.push(path)
    }
    for (const child of folder.folders || []) visit(child, prefix + child.name + '/')
  }
  visit(project.rootFolder[0], '')
  return paths.sort()
}

function tableBody(module) {
  return renderTable(module.table, module.title, module.id, { numbered: module.numbered !== false })
}

async function addDoc(projectId, project, name, text, userId) {
  return await EditorController.promises.addDoc(
    projectId,
    project.rootFolder[0]._id,
    name,
    text.split('\n'),
    'editor',
    userId,
  )
}

async function setDoc(projectId, doc, text, userId) {
  await DocumentUpdaterHandler.promises.setDocument(
    projectId,
    doc._id,
    userId,
    text.split('\n'),
    'editor',
  )
}

async function get(projectId) {
  const project = await getProject(projectId)
  return serialize(project, await readManifest(projectId, project))
}

async function initialize(projectId, userId, profile) {
  return await lock.promises.runWithLock(
    LOCK_NAMESPACE,
    projectId,
    async () => {
      const project = await getProject(projectId)
      const existing = await readManifest(projectId, project)
      if (existing) return serialize(project, existing)
      const root = project.rootFolder[0]
      if (
        [...root.docs, ...root.fileRefs].some(doc =>
          [MAIN_NAME, MANIFEST_NAME].includes(doc.name),
        )
      ) {
        throw new AssemblyError(
          '조립 파일과 같은 이름의 파일이 이미 있습니다. lab-assembled.tex 또는 lab-assembly.json의 이름을 바꾼 뒤 시작해 주세요.',
          409,
        )
      }
      const manifest =
        profile === CLEANER_PROFILE
          ? createCleanerManifest()
          : createManifest(project.name)
      for (const module of manifest.modules) {
        const body =
          module.kind === 'table'
            ? renderTable(module.table, module.title, module.id)
            : profile
              ? initialCleanerBody(module)
              : ''
        await addDoc(
          projectId,
          project,
          moduleFilename(module.id),
          body,
          userId,
        )
      }
      if (profile === CLEANER_PROFILE) {
        await EditorController.promises.addFile(
          projectId,
          project.rootFolder[0]._id,
          REFERENCE_DOCX,
          fileURLToPath(
            new URL('./assets/cleaner-reference.docx', import.meta.url),
          ),
          null,
          'editor',
          userId,
        )
      }
      const mainDoc = await addDoc(
        projectId,
        project,
        MAIN_NAME,
        renderManifest(manifest),
        userId,
      )
      await addDoc(
        projectId,
        project,
        MANIFEST_NAME,
        JSON.stringify(manifest, null, 2),
        userId,
      )
      await EditorController.promises.setRootDoc(projectId, mainDoc._id)
      EditorRealTimeController.emitToRoom(projectId, 'labAssemblyUpdated')
      return await get(projectId)
    },
  )
}

async function update(projectId, userId, version, operation) {
  return await lock.promises.runWithLock(
    LOCK_NAMESPACE,
    projectId,
    async () => {
      const project = await getProject(projectId)
      const manifest = await readManifest(projectId, project)
      if (!manifest)
        throw new AssemblyError('먼저 모듈 구성을 시작해 주세요.', 409)
      serialize(project, manifest)
      const next = applyOperation(manifest, version, operation)
      if (operation.type === 'figure' && operation.figure.path && !imageFiles(project).includes(operation.figure.path))
        throw new AssemblyError('프로젝트에 업로드한 그림 파일을 선택해 주세요.', 409)
      const mainDoc = findDoc(project, MAIN_NAME)
      const oldSource = (await readDoc(projectId, mainDoc)).lines.join('\n')
      if (oldSource !== renderManifest(manifest)) {
        throw new AssemblyError(
          '조립용 문서가 직접 수정되었습니다. 수정본을 다른 파일에 보관한 뒤 조립용 문서를 파일 이력에서 복원해 주세요.',
          409,
        )
      }
      for (const module of next.modules) {
        if (!manifest.modules.some(item => item.id === module.id)) {
          await addDoc(
            projectId,
            project,
            moduleFilename(module.id),
            module.kind === 'table'
              ? tableBody(module)
              : '',
            userId,
          )
        }
      }
      const changed = next.modules.filter(
        m =>
          m.kind === 'table' &&
          manifest.modules.some(
            old =>
              old.id === m.id &&
              (old.title !== m.title ||
                old.numbered !== m.numbered ||
                JSON.stringify(old.table) !== JSON.stringify(m.table)),
          ),
      )
      for (const module of changed) {
        const old = manifest.modules.find(m => m.id === module.id)
        const doc = findDoc(project, moduleFilename(module.id))
        const body = (await readDoc(projectId, doc)).lines.join('\n')
        if (body !== tableBody(old))
          throw new AssemblyError(
            '표 LaTeX가 직접 수정되었습니다. 수정본을 보관하고 파일 이력에서 원래 표를 복원해 주세요.',
            409,
          )
      }
      try {
        for (const module of changed)
          await setDoc(
            projectId,
            findDoc(project, moduleFilename(module.id)),
            tableBody(module),
            userId,
          )
        const nextSource = renderManifest(next)
        if (nextSource !== oldSource)
          await setDoc(projectId, mainDoc, nextSource, userId)
        await setDoc(
          projectId,
          findDoc(project, MANIFEST_NAME),
          JSON.stringify(next, null, 2),
          userId,
        )
      } catch (error) {
        await setDoc(projectId, mainDoc, oldSource, userId)
        for (const module of changed) {
          const old = manifest.modules.find(m => m.id === module.id)
          await setDoc(
            projectId,
            findDoc(project, moduleFilename(module.id)),
            tableBody(old),
            userId,
          )
        }
        throw error
      }
      await EditorController.promises.setRootDoc(projectId, mainDoc._id)
      EditorRealTimeController.emitToRoom(projectId, 'labAssemblyUpdated')
      return await get(projectId)
    },
  )
}

async function prepareWord(projectId, userId, version, target) {
  return await lock.promises.runWithLock(
    LOCK_NAMESPACE,
    projectId,
    async () => {
      const project = await getProject(projectId)
      const manifest = await readManifest(projectId, project)
      if (!manifest || manifest.profile !== CLEANER_PROFILE)
        throw new AssemblyError(
          'Cleaner Production 01 원고에서 Word 출력을 사용해 주세요.',
          409,
        )
      if (manifest.version !== version)
        throw new AssemblyError(
          '최신 구성을 불러온 뒤 다시 다운로드해 주세요.',
          409,
        )
      for (const module of manifest.modules.filter(m => m.kind === 'table')) {
        const actual = (
          await readDoc(projectId, findDoc(project, moduleFilename(module.id)))
        ).lines.join('\n')
        if (actual !== tableBody(module))
          throw new AssemblyError(
            '직접 수정한 표를 표 편집기와 동기화한 뒤 다운로드해 주세요.',
            409,
          )
      }
      const { source, settings } = renderWordSource(manifest, target)
      const name =
        target === 'highlights' ? 'lab-highlights-word.tex' : 'lab-word.tex'
      for (const [filename, body] of [
        [name, source],
        [name.slice(0, -4) + '-settings.json', JSON.stringify(settings)],
      ]) {
        const doc = findDoc(project, filename)
        if (doc) await setDoc(projectId, doc, body, userId)
        else await addDoc(projectId, project, filename, body, userId)
      }
      const current = await getProject(projectId)
      return {
        rootResourcePath: name,
        rootDoc_id: String(findDoc(current, name)._id),
      }
    },
  )
}
export default { get, initialize, update, prepareWord }
