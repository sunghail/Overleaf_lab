import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'
import { expressify } from '@overleaf/promise-utils'
import Manager from './LabAssemblyManager.mjs'
import { AssemblyError } from './LabAssemblyModel.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import {
  listTemplates,
  saveTemplate,
  createFromTemplate,
} from './LabTemplateManager.mjs'
import DocumentConversionManager from '../Uploads/DocumentConversionManager.mjs'
import { pipeline } from 'node:stream/promises'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'

const id = z.string().uuid()
const title = z.string().trim().min(1).max(200)
const params = z.object({ Project_id: zz.objectId() })
const operation = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add'),
      title,
      kind: z.enum([
        'section',
        'abstract',
        'highlights',
        'unnumbered',
        'table',
        'figure',
      ]),
      parentId: id.nullable(),
    })
    .strict(),
  z.object({ type: z.literal('rename'), id, title }).strict(),
  z.object({ type: z.literal('visibility'), id, hidden: z.boolean() }).strict(),
  z.object({ type: z.literal('table'), id, table: z.unknown() }).strict(),
  z.object({ type: z.literal('figure'), id, figure: z.unknown() }).strict(),
  z.object({ type: z.literal('numbering'), id, numbered: z.boolean() }).strict(),
  z.object({ type: z.literal('role'), id, kind: z.enum(['section', 'unnumbered', 'abstract', 'highlights', 'table', 'figure']) }).strict(),
  z
    .object({
      type: z.literal('metadata'),
      title,
      metadata: z
        .object({
          authors: z.string().max(3000),
          affiliations: z.string().max(3000),
          authorNotes: z.string().max(3000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('move'),
      id,
      parentId: id.nullable(),
      beforeId: id.nullable(),
    })
    .strict(),
])

function handle(action) {
  return expressify(async (req, res) => {
    try {
      const schema = z.object({
        params,
        ...(action === 'initialize' && { body: z.object({}).strict() }),
        ...(action === 'update' && {
          body: z
            .object({ version: z.number().int().min(1), operation })
            .strict(),
        }),
      })
      const input = parseReq(req, schema)
      const projectId = input.params.Project_id
      const userId = SessionManager.getLoggedInUserId(req.session)
      const result =
        action === 'get'
          ? await Manager.get(projectId)
          : action === 'initialize'
            ? await Manager.initialize(projectId, userId)
            : await Manager.update(
                projectId,
                userId,
                input.body.version,
                input.body.operation,
              )
      res.json(result)
    } catch (error) {
      if (!(error instanceof AssemblyError)) throw error
      res.status(error.status).json({ message: error.message })
    }
  })
}

export default {
  apply(webRouter) {
    const route = '/project/:Project_id/lab-assembly'
    webRouter.get(
      `${route}/workspace`,
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      expressify(async (req, res) => {
        const input = parseReq(req, z.object({ params }))
        const projectId = input.params.Project_id
        const project = await ProjectGetter.promises.getProject(projectId, {
          name: 1,
          compiler: 1,
        })
        if (!project) return res.status(404).send('프로젝트를 찾을 수 없습니다.')
        const canWrite =
          await AuthorizationManager.promises.canUserWriteProjectContent(
            SessionManager.getLoggedInUserId(req.session),
            projectId,
            TokenAccessHandler.getRequestToken(req, projectId),
          )
        res.render('project/lab-assembly-workspace', {
          title: '논문 조립',
          project: {
            _id: projectId,
            name: project.name,
            compiler: project.compiler,
          },
          canWrite,
        })
      }),
    )
    webRouter.get(
      route,
      AuthorizationMiddleware.ensureUserCanReadProject,
      handle('get'),
    )
    webRouter.post(
      `${route}/initialize`,
      AsyncLocalStorage.middleware,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      handle('initialize'),
    )
    webRouter.put(
      route,
      AsyncLocalStorage.middleware,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      handle('update'),
    )
    webRouter.get(
      '/lab-templates',
      AuthenticationController.requireLogin(),
      expressify(async (req, res) => {
        res.json(
          await listTemplates(SessionManager.getLoggedInUserId(req.session)),
        )
      }),
    )
    webRouter.post(
      '/lab-templates/create',
      AuthenticationController.requireLogin(),
      AsyncLocalStorage.middleware,
      expressify(async (req, res) => {
        const input = parseReq(
          req,
          z.object({
            body: z
              .object({
                templateId: z.union([
                  z.literal('cleaner-production-01'),
                  zz.objectId(),
                ]),
                name: title,
              })
              .strict(),
          }),
        )
        try {
          res.json(
            await createFromTemplate(
              SessionManager.getLoggedInUserId(req.session),
              input.body.templateId,
              input.body.name,
            ),
          )
        } catch (error) {
          if (!(error instanceof AssemblyError)) throw error
          res.status(error.status).json({ message: error.message })
        }
      }),
    )
    webRouter.post(
      `${route}/template`,
      AsyncLocalStorage.middleware,
      AuthorizationMiddleware.ensureUserCanReadProject,
      expressify(async (req, res) => {
        const input = parseReq(
          req,
          z.object({ params, body: z.object({ name: title }).strict() }),
        )
        res.json(
          await saveTemplate(
            SessionManager.getLoggedInUserId(req.session),
            input.params.Project_id,
            input.body.name,
          ),
        )
      }),
    )
    webRouter.post(
      `${route}/word`,
      AsyncLocalStorage.middleware,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      expressify(async (req, res) => {
        const input = parseReq(
          req,
          z.object({
            params,
            body: z
              .object({
                version: z.number().int().min(1),
                target: z.enum(['manuscript', 'highlights']),
              })
              .strict(),
          }),
        )
        const projectId = input.params.Project_id,
          userId = SessionManager.getLoggedInUserId(req.session)
        try {
          const rootOptions = await Manager.prepareWord(
            projectId,
            userId,
            input.body.version,
            input.body.target,
          )
          const output =
            await DocumentConversionManager.promises.convertProjectToDocument(
              projectId,
              userId,
              'docx',
              { ...rootOptions, compileFromHistory: false },
            )
          const { stream } =
            await DocumentConversionManager.promises.streamConvertedProjectDocument(
              output,
            )
          res.attachment(
            input.body.target === 'highlights'
              ? 'Highlights.docx'
              : 'Cleaner_Production_Manuscript.docx',
          )
          await pipeline(stream, res)
        } catch (error) {
          if (res.headersSent) throw error
          if (error instanceof AssemblyError)
            res.status(error.status).json({ message: error.message })
          else if (error.name === 'DocumentConversionError')
            res.status(422).json({ message: error.message })
          else throw error
        }
      }),
    )
  },
}
