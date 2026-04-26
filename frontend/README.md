# Frontend — ChatApp

Next.js 14 (App Router) + React 18 + Redux Toolkit + RTK Query +
Socket.IO client + Tailwind CSS.

```
app/
├── layout.tsx                Providers + SessionBootstrap
├── providers.tsx             Redux <Provider> + toast/lightbox portals
├── SessionBootstrap.tsx      Silent token refresh on first mount
├── globals.css               Tailwind + scrollbar polish
├── (auth)/                   Public: login / register / verify-email
└── (chat)/                   Protected: sidebar + [conversationId]
components/
├── auth/                     RegisterForm, LoginForm, OtpInput, VerifyEmailForm
├── chat/                     ChatWindow, ConversationList, MessageBubble, ...
└── ui/                       Avatar, Badge, Button, Input, Modal, Skeleton, Toast
hooks/
├── useAppDispatch.ts         Typed dispatch + selector
├── useSocket.ts              Mounts listeners + cache updates
├── useTyping.ts              Debounced typing emits
└── useInfiniteMessages.ts    Pagination + scroll anchoring
lib/
├── axiosBaseQuery.ts         RTK Query axios adapter (unwraps ApiResponse)
├── socket.ts                 Singleton socket.io-client
└── utils.ts                  cn / initials / formatters
store/
├── index.ts                  configureStore
├── slices/                   authSlice, chatSlice, uiSlice
└── api/                      baseApi (+ re-auth), authApi, userApi,
                              conversationApi, messageApi
validations/                  Zod schemas for forms
middleware.ts                 Cookie-based route guard
```

## Scripts

```bash
npm run dev         # next dev
npm run build       # next build
npm start           # next start
npm run typecheck   # tsc --noEmit
```

## Data flow

### Send a message (optimistic)

```
MessageInput
  → crypto.randomUUID() = clientTempId
  → manually insert optimistic IMessage into RTK Query cache (status:'sending')
  → socket.emit('send_message', { conversationId, content, clientTempId }, ack)
  → backend persists + broadcasts 'new_message' to the conversation room
useSocket
  → on 'new_message', find msg with matching clientTempId and replace with real doc
  → if ack says !ok, flip status:'failed'
```

### Silent token refresh

RTK Query's `baseApi` wraps `axiosBaseQuery` with a re-auth adapter:

1. A request returns 401 → pause.
2. Fire a single `/auth/refresh` (guarded by an in-memory mutex so parallel
   requests share the one refresh call).
3. On success, dispatch `setCredentials` and replay the original request.
4. On failure, dispatch `logoutAction` → middleware bounces to `/login`.

### Presence & typing

- `useSocket` stores online user IDs + last-seen timestamps in `chatSlice`.
- `OnlineStatus` derives the pill from the socket-driven Redux state.
- `useTyping` debounces: emit `typing_start` once, then `typing_stop` 1.5 s
  after the last keystroke — or immediately on submit/blur.

## Theming

Design tokens live in `tailwind.config.ts` under `colors.brand`, `colors.bg`,
`colors.ink`. Swap those six values to re-skin the whole app.

## Extension ideas

- Group conversations (models already support `isGroup`, `groupName`, `groupAdmin`).
- Push notifications via web-push on `new_message`.
- Message reactions — a `reactions: [{ user, emoji, createdAt }]` array on
  `Message` plus two socket events.
- Voice / video calls with Mediasoup or simple WebRTC + Socket.IO signalling.
