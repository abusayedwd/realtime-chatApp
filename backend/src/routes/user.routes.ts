import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'
import { getMe, updateMe, searchUsers, getUserById } from '../controllers/user.controller'
import { searchUsersSchema, updateProfileSchema } from '../validations/message.schema'

const router = Router()
router.use(authenticate)

router.get('/me', getMe)
router.put('/me', validate(updateProfileSchema), updateMe)
router.get('/search', validate(searchUsersSchema), searchUsers)
router.get('/:id', getUserById)

export default router
