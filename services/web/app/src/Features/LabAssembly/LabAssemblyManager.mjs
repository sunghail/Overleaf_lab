import ProjectGetter from '../Project/ProjectGetter.mjs'
import EditorController from '../Editor/EditorController.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import {
  AssemblyError,
  MANIFEST_NAME,
  MAIN_NAME,
  createManifest,
  validateManifest,
  moduleFilename,
  renderManifest,
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
  return {
    version: manifest.version,
    title: manifest.title,
    mainDoc: { _id: mainDoc._id.toString(), name: mainDoc.name },
    modules: manifest.modules.map(module => {
      const doc = findDoc(project, moduleFilename(module.id))
      if (!doc)
        throw new AssemblyError(
          `“${module.title}”의 본문 파일을 복원해 주세요.`,
          409,
        )
      return { ...module, doc: { _id: doc._id.toString(), name: doc.name } }
    }),
  }
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

async function initialize(projectId, userId) {
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
      const manifest = createManifest(project.name)
      for (const module of manifest.modules) {
        await addDoc(projectId, project, moduleFilename(module.id), '', userId)
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
            '',
            userId,
          )
        }
      }
      await setDoc(projectId, mainDoc, renderManifest(next), userId)
      try {
        await setDoc(
          projectId,
          findDoc(project, MANIFEST_NAME),
          JSON.stringify(next, null, 2),
          userId,
        )
      } catch (error) {
        await setDoc(projectId, mainDoc, oldSource, userId)
        throw error
      }
      await EditorController.promises.setRootDoc(projectId, mainDoc._id)
      EditorRealTimeController.emitToRoom(projectId, 'labAssemblyUpdated')
      return await get(projectId)
    },
  )
}

export default { get, initialize, update }
