import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { Conversation } from '../../models/Conversation.model'
import { Message } from '../../models/Message.model'
import { logger } from '../../utils/logger'
import type { ChatSocket } from '../socket'

type CallType = 'audio' | 'video'

interface BaseCallPayload {
  toUserId: string
  conversationId: string
}

interface CallUserPayload extends BaseCallPayload {
  callType: CallType
}

interface CallResponsePayload extends BaseCallPayload {
  accepted: boolean
  callType: CallType
  reason?: string
}

interface WebRtcOfferPayload extends BaseCallPayload {
  callType: CallType
  sdp: Record<string, unknown>
}

interface WebRtcAnswerPayload extends BaseCallPayload {
  sdp: Record<string, unknown>
}

interface IceCandidatePayload extends BaseCallPayload {
  candidate: Record<string, unknown>
}

interface EndCallPayload extends BaseCallPayload {
  reason?: string
}

const validateObjectId = (value: string, label: string) => {
  if (!mongoose.isValidObjectId(value)) throw new Error(`${label} is invalid`)
}

const ensureConversationAccess = async (conversationId: string, userA: string, userB: string) => {
  validateObjectId(conversationId, 'conversationId')
  validateObjectId(userA, 'userId')
  validateObjectId(userB, 'toUserId')

  const convo = await Conversation.findOne({
    _id: new mongoose.Types.ObjectId(conversationId),
    participants: {
      $all: [new mongoose.Types.ObjectId(userA), new mongoose.Types.ObjectId(userB)],
    },
  }).select('_id participants')

  if (!convo) throw new Error('Users are not in the same conversation')
  return convo
}

interface ActiveCallMeta {
  conversationId: string
  callerId: string
  calleeId: string
  callType: CallType
  accepted: boolean
  startedAt: number
  acceptedAt?: number
}

const activeCalls = new Map<string, ActiveCallMeta>()
const userCallIndex = new Map<string, string>()

const getCallKey = (conversationId: string, userA: string, userB: string) =>
  `${conversationId}:${[userA, userB].sort().join(':')}`

const registerActiveCall = (key: string, meta: ActiveCallMeta) => {
  activeCalls.set(key, meta)
  userCallIndex.set(meta.callerId, key)
  userCallIndex.set(meta.calleeId, key)
}

const clearActiveCall = (key: string) => {
  const active = activeCalls.get(key)
  if (active) {
    userCallIndex.delete(active.callerId)
    userCallIndex.delete(active.calleeId)
  }
  activeCalls.delete(key)
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getUnreadCount = async (conversationId: string, targetUserId: string) => {
  const uid = new mongoose.Types.ObjectId(targetUserId)
  return Message.countDocuments({
    conversationId,
    sender: { $ne: uid },
    isDeleted: false,
    deletedFor: { $nin: [uid] },
    'readBy.user': { $nin: [uid] },
  })
}

const emitUnreadForUser = async (io: Server, conversationId: string, targetUserId: string) => {
  const count = await getUnreadCount(conversationId, targetUserId)
  io.to(`user:${targetUserId}`).emit('unread_count_updated', { conversationId, count })
}

const emitCallLog = async (
  io: Server,
  conversationId: string,
  senderId: string,
  participants: mongoose.Types.ObjectId[],
  content: string
) => {
  const message = await Message.create({
    conversationId,
    sender: senderId,
    type: 'text',
    content,
    readBy: [{ user: senderId, readAt: new Date() }],
  })

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: message._id,
    lastMessageAt: new Date(),
  })

  const populated = await message.populate([{ path: 'sender', select: 'name email avatar' }])
  const json = populated.toJSON()

  io.to(conversationId).emit('new_message', { message: json })
  participants.forEach((pid) => {
    io.to(`user:${pid.toString()}`).emit('conversation_updated', {
      conversationId,
      lastMessage: {
        _id: json._id,
        content: json.content,
        type: json.type,
        sender: json.sender,
        createdAt: json.createdAt,
        fileName: json.fileName,
      },
      lastMessageAt: json.createdAt,
    })
  })
  await Promise.all(participants.map((pid) => emitUnreadForUser(io, conversationId, pid.toString())))
}

export const registerCallHandlers = (io: Server, socket: ChatSocket) => {
  const { userId } = socket.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('call_user', async (body: CallUserPayload, ack: any) => {
    try {
      const { toUserId, conversationId, callType } = body
      if (callType !== 'audio' && callType !== 'video') throw new Error('Invalid call type')

      await ensureConversationAccess(conversationId, userId, toUserId)
      const key = getCallKey(conversationId, userId, toUserId)
      if (userCallIndex.get(userId) && userCallIndex.get(userId) !== key) {
        throw new Error('You are already in a call')
      }
      const calleeActiveKey = userCallIndex.get(toUserId)
      if (calleeActiveKey && calleeActiveKey !== key) {
        io.to(`user:${userId}`).emit('call_response', {
          fromUserId: toUserId,
          conversationId,
          accepted: false,
          callType,
          reason: 'busy',
        })
        ack?.({ ok: true })
        return
      }

      registerActiveCall(key, {
        conversationId,
        callerId: userId,
        calleeId: toUserId,
        callType,
        accepted: false,
        startedAt: Date.now(),
      })

      io.to(`user:${toUserId}`).emit('incoming_call', {
        fromUserId: userId,
        conversationId,
        callType,
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('call_response', async (body: CallResponsePayload, ack: any) => {
    try {
      const { toUserId, conversationId, accepted, callType, reason } = body
      const convo = await ensureConversationAccess(conversationId, userId, toUserId)
      const key = getCallKey(conversationId, userId, toUserId)
      const active = activeCalls.get(key)
      if (accepted) {
        const callerId = active?.callerId ?? toUserId
        registerActiveCall(key, {
          conversationId,
          callerId,
          calleeId: userId === callerId ? toUserId : userId,
          callType,
          accepted: true,
          startedAt: active?.startedAt ?? Date.now(),
          acceptedAt: Date.now(),
        })
      } else {
        const label = callType === 'video' ? 'Video' : 'Audio'
        await emitCallLog(
          io,
          conversationId,
          userId,
          convo.participants ?? [],
          `📞 ${label} call rejected`
        )
        clearActiveCall(key)
      }

      io.to(`user:${toUserId}`).emit('call_response', {
        fromUserId: userId,
        conversationId,
        accepted,
        callType,
        reason,
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('webrtc_offer', async (body: WebRtcOfferPayload, ack: any) => {
    try {
      const { toUserId, conversationId, callType, sdp } = body
      if (!sdp) throw new Error('Offer SDP is required')
      await ensureConversationAccess(conversationId, userId, toUserId)

      io.to(`user:${toUserId}`).emit('webrtc_offer', {
        fromUserId: userId,
        conversationId,
        callType,
        sdp,
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('webrtc_answer', async (body: WebRtcAnswerPayload, ack: any) => {
    try {
      const { toUserId, conversationId, sdp } = body
      if (!sdp) throw new Error('Answer SDP is required')
      await ensureConversationAccess(conversationId, userId, toUserId)

      io.to(`user:${toUserId}`).emit('webrtc_answer', {
        fromUserId: userId,
        conversationId,
        sdp,
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('webrtc_ice_candidate', async (body: IceCandidatePayload, ack: any) => {
    try {
      const { toUserId, conversationId, candidate } = body
      if (!candidate) throw new Error('ICE candidate is required')
      await ensureConversationAccess(conversationId, userId, toUserId)

      io.to(`user:${toUserId}`).emit('webrtc_ice_candidate', {
        fromUserId: userId,
        conversationId,
        candidate,
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on('call_end', async (body: EndCallPayload, ack: any) => {
    try {
      const { toUserId, conversationId, reason } = body
      const convo = await ensureConversationAccess(conversationId, userId, toUserId)
      const key = getCallKey(conversationId, userId, toUserId)
      const active = activeCalls.get(key)

      io.to(`user:${toUserId}`).emit('call_ended', {
        fromUserId: userId,
        conversationId,
        reason: reason ?? 'ended',
      })

      if (active) {
        const label = active.callType === 'video' ? 'Video' : 'Audio'
        const durationMs = active.acceptedAt ? Date.now() - active.acceptedAt : 0
        const content = active.accepted
          ? `📞 ${label} call ended (${formatDuration(durationMs)})`
          : reason === 'no-answer'
            ? `📞 Missed ${label.toLowerCase()} call`
            : `📞 ${label} call ended`
        await emitCallLog(io, conversationId, userId, convo.participants ?? [], content)
        clearActiveCall(key)
      }
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message })
    }
  })

  socket.on('disconnect', async () => {
    const key = userCallIndex.get(userId)
    if (!key) return
    const active = activeCalls.get(key)
    if (!active) {
      userCallIndex.delete(userId)
      return
    }
    const peerId = active.callerId === userId ? active.calleeId : active.callerId
    try {
      const convo = await ensureConversationAccess(active.conversationId, userId, peerId)
      io.to(`user:${peerId}`).emit('call_ended', {
        fromUserId: userId,
        conversationId: active.conversationId,
        reason: 'disconnected',
      })
      const label = active.callType === 'video' ? 'Video' : 'Audio'
      const durationMs = active.acceptedAt ? Date.now() - active.acceptedAt : 0
      const content = active.accepted
        ? `📞 ${label} call ended (${formatDuration(durationMs)})`
        : `📞 Missed ${label.toLowerCase()} call`
      await emitCallLog(io, active.conversationId, userId, convo.participants ?? [], content)
    } catch (err) {
      logger.warn('call disconnect cleanup failed:', err)
    } finally {
      clearActiveCall(key)
    }
  })

  socket.on('error', (err) => {
    logger.warn('Call socket error:', err)
  })
}
