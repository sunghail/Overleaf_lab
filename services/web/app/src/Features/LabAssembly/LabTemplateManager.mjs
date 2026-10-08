import { Project } from '../../models/Project.mjs'
import UserGetter from '../User/UserGetter.mjs'
import ProjectDuplicator from '../Project/ProjectDuplicator.mjs'
import ProjectCreationHandler from '../Project/ProjectCreationHandler.mjs'
import Assembly from './LabAssemblyManager.mjs'
import { AssemblyError } from './LabLatex.mjs'
import { CLEANER_PROFILE } from './LabCleanerTemplate.mjs'
export async function listTemplates(userId) {
  return {
    builtin: [
      {
        id: CLEANER_PROFILE,
        name: 'Cleaner Production 01',
        description: 'Word 투고 원고 · A4 · Times New Roman 12pt · 계수표 01',
      },
    ],
    saved: await Project.find(
      { owner_ref: userId, labTemplateName: { $exists: true } },
      { name: 1, labTemplateName: 1, lastUpdated: 1 },
    )
      .sort({ lastUpdated: -1 })
      .lean()
      .exec(),
  }
}
export async function saveTemplate(userId, projectId, name) {
  const owner = await UserGetter.promises.getUser(userId, { _id: 1 })
  const copy = await ProjectDuplicator.promises.duplicate(
    owner,
    projectId,
    `[Template] ${name}`,
  )
  await Project.updateOne(
    { _id: copy._id },
    { $set: { labTemplateName: name } },
  ).exec()
  return { projectId: String(copy._id), name }
}
export async function createFromTemplate(userId, id, name) {
  if (id === CLEANER_PROFILE) {
    const project = await ProjectCreationHandler.promises.createBlankProject(
      userId,
      name,
    )
    await Assembly.initialize(String(project._id), userId, CLEANER_PROFILE)
    await Project.updateOne(
      { _id: project._id },
      { $set: { compiler: 'xelatex' } },
    ).exec()
    return { projectId: String(project._id) }
  }
  const template = await Project.findOne(
    { _id: id, owner_ref: userId, labTemplateName: { $exists: true } },
    { _id: 1 },
  )
    .lean()
    .exec()
  if (!template)
    throw new AssemblyError('저장한 템플릿을 찾을 수 없습니다.', 404)
  const owner = await UserGetter.promises.getUser(userId, { _id: 1 })
  const copy = await ProjectDuplicator.promises.duplicate(
    owner,
    template._id,
    name,
  )
  return { projectId: String(copy._id) }
}
