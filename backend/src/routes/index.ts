import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import conversationRoutes from './conversation.routes'
import messageRoutes from './message.routes'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }))

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/conversations', conversationRoutes)
router.use('/messages', messageRoutes)

export default router
