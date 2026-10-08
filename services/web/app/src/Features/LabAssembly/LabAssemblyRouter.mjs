import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'
import { expressify } from '@overleaf/promise-utils'
import Manager from './LabAssemblyManager.mjs'
import { AssemblyError } from './LabAssemblyModel.mjs'

const id = z.string().uuid()
const title = z.string().trim().min(1).max(200)
const params = z.object({ Project_id: zz.objectId() })
const operation = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add'),
      title,
      kind: z.enum(['section', 'abstract', 'highlights']),
      parentId: id.nullable(),
    })
    .strict(),
  z.object({ type: z.literal('rename'), id, title }).strict(),
  z.object({ type: z.literal('visibility'), id, hidden: z.boolean() }).strict(),
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
  },
}
