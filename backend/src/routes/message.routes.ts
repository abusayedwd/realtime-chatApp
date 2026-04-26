import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'
import { upload } from '../middlewares/upload.middleware'
import {
  getMessages,
  sendTextMessage,
  uploadAndSend,
  markAsRead,
  deleteMessage,
} from '../controllers/message.controller'
import {
  sendMessageSchema,
  getMessagesSchema,
  markReadSchema,
} from '../validations/message.schema'

const router = Router()
router.use(authenticate)

router.get('/:conversationId', validate(getMessagesSchema), getMessages)
router.post('/:conversationId', validate(sendMessageSchema), sendTextMessage)
router.post('/:conversationId/upload', upload.single('file'), uploadAndSend)
router.patch('/:conversationId/read', validate(markReadSchema), markAsRead)
router.delete('/:messageId', deleteMessage)

export default router
