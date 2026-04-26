# Backend — ChatApp

Express + TypeScript API with Socket.IO, MongoDB (Mongoose) and Redis.

```
src/
├── app.ts                    Express app (helmet, cors, sanitize, routes)
├── server.ts                 Boot: DB → Mailer → HTTP + Socket.IO
├── config/
│   ├── env.ts                Zod-validated environment schema
│   ├── db.ts                 Mongoose connect with retry
│   ├── redis.ts              ioredis + node-redis (adapter)
│   ├── mailer.ts             Nodemailer SMTP transporter
│   └── cloudinary.ts
├── models/                   User, Conversation, Message (indexed)
├── validations/              Zod schemas (auth + messages)
├── middlewares/
│   ├── validate.middleware.ts
│   ├── auth.middleware.ts
│   ├── upload.middleware.ts  Multer memory storage, 50MB, MIME whitelist
│   ├── rateLimiter.middleware.ts   Redis-backed limits (auth, OTP, API)
│   └── error.middleware.ts   Central error handler + 404
├── services/                 auth, email, token, file (business logic)
├── controllers/              Thin — they call services, send responses
├── routes/                   Mounted under /api
└── socket/
    ├── socket.ts             io init + JWT handshake + Redis adapter
    └── handlers/             message, typing, presence
```

## Scripts

```bash
npm run dev        # tsx watch src/server.ts
npm run build      # tsc → dist/
npm start          # node dist/server.js (production)
npm run typecheck  # tsc --noEmit
```

## Environment

See `.env.example`. Every var is runtime-validated on boot — the server
refuses to start if anything is missing or malformed.

## Key design choices

- **Two Redis clients**: `ioredis` for `rate-limit-redis`, `node-redis` (v4) for the Socket.IO adapter — each library requires its own flavour.
- **Refresh token storage**: SHA-256 hash in Redis at `refresh:<userId>`, TTL 7 days. On logout we just `DEL` it — stateless-ish with a Redis fallback.
- **Refresh rotation** on every `/auth/refresh` — a stolen refresh token only works once.
- **OTP lockout**: 5 failed attempts → 30 min lock, tracked on the user document (not Redis) so admins can reset via a DB update if needed.
- **Presence**: socket count per user — we only mark offline when the last socket disconnects (handles multi-tab correctly).
- **Cross-socket-instance broadcast**: `io.to(conversationId).emit(...)` works even when users are on different server instances thanks to the Redis adapter.
