/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config()
const mongoose = require('mongoose')
const { io } = require('../../frontend/node_modules/socket.io-client')
const jwt = require('jsonwebtoken')

const SOCKET_URL = process.env.SOCKET_TEST_URL || 'http://localhost:5000'
const MONGODB_URI = process.env.MONGODB_URI

const emitAck = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), 8000)
    socket.emit(event, payload, (res) => {
      clearTimeout(timer)
      resolve({ ok: Boolean(res?.ok), error: res?.error })
    })
  })

const waitFor = (socket, event, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI missing')

  await mongoose.connect(MONGODB_URI)
  console.log('✓ MongoDB connected')

  const Conversation = mongoose.model(
    'Conversation',
    new mongoose.Schema({ participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], isGroup: Boolean })
  )
  const User = mongoose.model(
    'User',
    new mongoose.Schema({ email: String, name: String, isVerified: Boolean })
  )

  const dm = await Conversation.findOne({ isGroup: { $ne: true }, participants: { $size: 2 } })
    .select('_id participants')
    .lean()

  if (!dm) throw new Error('No 1:1 conversation found — open a chat between two users first')

  const userAId = String(dm.participants[0])
  const userBId = String(dm.participants[1])
  const [userA, userB] = await Promise.all([
    User.findById(userAId).select('email name').lean(),
    User.findById(userBId).select('email name').lean(),
  ])
  if (!userA || !userB) throw new Error('Conversation participants not found')

  const secret = process.env.JWT_ACCESS_SECRET
  const tokenA = jwt.sign({ userId: userAId, email: userA.email }, secret, { expiresIn: '15m' })
  const tokenB = jwt.sign({ userId: userBId, email: userB.email }, secret, { expiresIn: '15m' })

  const socketA = io(SOCKET_URL, { auth: { token: tokenA }, transports: ['websocket', 'polling'], forceNew: true })
  const socketB = io(SOCKET_URL, { auth: { token: tokenB }, transports: ['websocket', 'polling'], forceNew: true })

  await Promise.all([
    new Promise((res, rej) => {
      socketA.once('connect', res)
      socketA.once('connect_error', rej)
    }),
    new Promise((res, rej) => {
      socketB.once('connect', res)
      socketB.once('connect_error', rej)
    }),
  ])
  console.log(`✓ Sockets connected (${userA.name} ↔ ${userB.name})`)

  const conversationId = String(dm._id)

  const responsePromise = waitFor(socketA, 'call_response')

  socketB.once('incoming_call', (payload) => {
    if (payload.fromUserId !== userAId || payload.conversationId !== conversationId) {
      throw new Error('incoming_call payload mismatch')
    }
    incomingResolve(payload)
  })
  let incomingResolve
  const incomingPromise = new Promise((resolve, reject) => {
    incomingResolve = resolve
    setTimeout(() => reject(new Error('Timeout waiting for incoming_call')), 15000)
  })

  const startRes = await emitAck(socketA, 'call_user', {
    toUserId: userBId,
    conversationId,
    callType: 'audio',
  })
  if (!startRes.ok) throw new Error(`call_user failed: ${startRes.error}`)
  console.log('✓ call_user ack ok')

  const incoming = await incomingPromise
  if (incoming.fromUserId !== userAId) throw new Error('incoming_call payload mismatch')
  console.log('✓ incoming_call received on callee')

  const acceptRes = await emitAck(socketB, 'call_response', {
    toUserId: userAId,
    conversationId,
    accepted: true,
    callType: 'audio',
  })
  if (!acceptRes.ok) throw new Error(`call_response failed: ${acceptRes.error}`)

  const response = await responsePromise
  if (!response.accepted) throw new Error('call_response not accepted on caller')
  console.log('✓ call accepted')

  const offerWait = waitFor(socketB, 'webrtc_offer')
  const answerWait = waitFor(socketA, 'webrtc_answer')
  const offerRes = await emitAck(socketA, 'webrtc_offer', {
    toUserId: userBId,
    conversationId,
    callType: 'audio',
    sdp: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' },
  })
  if (!offerRes.ok) throw new Error(`webrtc_offer failed: ${offerRes.error}`)
  await offerWait
  console.log('✓ webrtc_offer relayed')

  const answerRes = await emitAck(socketB, 'webrtc_answer', {
    toUserId: userAId,
    conversationId,
    sdp: { type: 'answer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' },
  })
  if (!answerRes.ok) throw new Error(`webrtc_answer failed: ${answerRes.error}`)
  await answerWait
  console.log('✓ webrtc_answer relayed')

  const iceWait = waitFor(socketB, 'webrtc_ice_candidate')
  const endWait = waitFor(socketB, 'call_ended')
  const iceRes = await emitAck(socketA, 'webrtc_ice_candidate', {
    toUserId: userBId,
    conversationId,
    candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  })
  if (!iceRes.ok) throw new Error(`webrtc_ice_candidate failed: ${iceRes.error}`)
  await iceWait
  console.log('✓ webrtc_ice_candidate relayed')

  const endRes = await emitAck(socketA, 'call_end', {
    toUserId: userBId,
    conversationId,
    reason: 'ended',
  })
  if (!endRes.ok) throw new Error(`call_end failed: ${endRes.error}`)
  await endWait
  console.log('✓ call_end relayed')

  socketA.disconnect()
  socketB.disconnect()
  await mongoose.disconnect()

  console.log('\n✅ Call signaling smoke test PASSED')
}

main().catch((err) => {
  console.error('\n❌ Call signaling test FAILED:', err.message || err)
  process.exit(1)
})
