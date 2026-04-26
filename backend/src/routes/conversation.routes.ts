import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'
import {
  listConversations,
  createOrGetDM,
  getConversation,
  updateBackground,
  deleteConversation,
} from '../controllers/conversation.controller'
import { createConversationSchema } from '../validations/message.schema'

const router = Router()
router.use(authenticate)

router.get('/', listConversations)
router.post('/', validate(createConversationSchema), createOrGetDM)
router.get('/:id', getConversation)
router.patch('/:id/background', updateBackground)
router.delete('/:id', deleteConversation)

export default router
