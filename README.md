# ChatApp — Production-Grade Real-Time Chat

A full-stack, real-time messaging platform built with a production mindset:
SSR UI, predictable state, stateless auth with rotating refresh tokens, live
presence, typing, read receipts, file sharing, and horizontal scaling built
into the design.

```
/
├── backend/    Node + Express + TypeScript + Socket.IO + MongoDB + Redis
└── frontend/   Next.js 14 (App Router) + Redux Toolkit + RTK Query + Tailwind
```

## Highlights

- **Auth** — Email/password register → 6-digit OTP email → JWT access (15 m) + rotating refresh (7 d) stored as HTTP-only cookie; refresh-token hashes kept in Redis.
- **Brute-force protection** — OTP attempt counter + 30-minute lockout after 5 failures, plus Redis-backed rate limits on all auth endpoints.
- **Real-time** — Socket.IO with Redis adapter (horizontal-scale ready), JWT handshake auth, per-conversation rooms.
- **State** — Redux Toolkit for UI/session, RTK Query for server cache, optimistic sends, silent token refresh, a single inline mutex that de-dupes parallel 401s.
- **Messages** — text / image / video / file (50 MB, MIME whitelisted, Cloudinary).
- **UX** — typing indicator, read receipts (sending → sent → delivered → read), last-seen, unread badges, infinite scroll, image lightbox, video player, modern dark theme.
- **Security** — Helmet, CORS, mongo-sanitize, compression, Zod validation on both ends, env schema check on boot.

## Quick start

### 1. Prerequisites

- Node.js 18+ and npm
- MongoDB 6+ (local or Atlas)
- Redis 6+ (local or Upstash/Redis Cloud)
- SMTP credentials (Gmail app password works great for dev)
- Cloudinary account (for file uploads)

### 2. Backend

```bash
cd backend
cp .env.example .env
# fill in values — MongoDB URI, Redis URL, JWT secrets (≥ 32 chars),
# SMTP creds, Cloudinary creds.
npm install
npm run dev
```

Server runs on `http://localhost:5006` (health check at `/api/health`).

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App runs on `http://localhost:3000`.

## Architecture

### Auth Flow

```
Register → OTP email → Verify (brute-force protected) → Login
  → issue access (15 m) + refresh (7 d, http-only cookie, hash in Redis)
  → silent refresh on 401 (RTK Query reauth baseQuery)
  → logout revokes refresh via Redis DEL
```

### Socket.IO

- Handshake authenticates via `auth.token` (JWT access).
- Every user joins a personal room `user:<id>` plus every conversation room on connect — so the server can target a single user across tabs.
- Presence is derived from socket count: a user only goes offline when the last socket disconnects.

Client → server: `join_conversation`, `leave_conversation`, `send_message`,
`typing_start`, `typing_stop`, `message_read`, `get_online_users`.

Server → client: `new_message`, `typing`, `messages_read`, `user_online`,
`user_offline`, `message_deleted`.

### Read-receipt logic

Each `Message.readBy` is an array of `{ user, readAt }`. Unread count is:

```js
Message.countDocuments({
  conversationId,
  sender: { $ne: userId },
  'readBy.user': { $nin: [userId] },
})
```

When the user opens a conversation, the UI batches unread message IDs, calls
`PATCH /api/messages/:id/read`, which pushes receipts and emits
`messages_read` — the sender's UI then flips single-ticks to blue.

## API surface

See the prompt in the project root for the full table; highlights:

```
POST   /api/auth/register        ← rate limited, Zod
POST   /api/auth/verify-email    ← OTP brute-force protected
POST   /api/auth/login           ← issues access + sets refresh cookie
POST   /api/auth/refresh         ← rotates both tokens
POST   /api/auth/logout          ← revokes refresh
POST   /api/auth/resend-otp      ← 60s cooldown + 5/30min rate limit
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/search?q=&limit=
GET    /api/conversations
POST   /api/conversations              { participantId }
GET    /api/conversations/:id
DELETE /api/conversations/:id
GET    /api/messages/:conversationId?page=&limit=
POST   /api/messages/:conversationId   { type, content, ... }
POST   /api/messages/:conversationId/upload   multipart, 50MB
PATCH  /api/messages/:conversationId/read     { messageIds }
DELETE /api/messages/:messageId
```

## Notes / Production checklist

- Run Mongo and Redis behind TLS; set `secure: true` on the cookie
  (already wired on `NODE_ENV=production`).
- Put the API behind a reverse proxy (nginx / Caddy) that terminates TLS and
  forwards `X-Forwarded-For` — `app.set('trust proxy', 1)` is already on.
- Scale Socket.IO by simply running more processes: the `@socket.io/redis-adapter`
  replicates room broadcasts across instances.
- Swap Nodemailer for a BullMQ-backed queue if you start sending thousands of
  OTPs — the email call is otherwise synchronous with `register`.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` regularly; both are
  validated on process start (must be ≥ 32 chars).
