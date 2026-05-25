# TODO - NotifyTechAI immediate scope (OpenWA flow stable first)

- [ ] Step 1: Inspect existing backend routes/modules for session + message send
  - [ ] Locate session controller/service
  - [ ] Locate messages controller/service
  - [ ] Locate any existing OpenWA integration/wrapper

- [ ] Step 2: Add/implement minimal Phase-1 backend endpoints
  - [ ] POST /api/sessions (create)
  - [ ] GET /api/sessions/:id/qr (QR + status polling)
  - [ ] POST /api/messages/send (send text)
  - [ ] (Optional) DELETE /api/sessions/:id

- [ ] Step 3: Implement minimal OpenWA wrapper operations
  - [ ] create session
  - [ ] fetch QR / session status
  - [ ] send text message

- [ ] Step 4: Implement connection detection
  - [ ] Handle OpenWA webhook/event for session-connected
  - [ ] Handle OpenWA webhook/event for session-disconnected
  - [ ] Update minimal session status store used by polling

- [ ] Step 5: Implement tenant ownership checks (Phase-1 only)
  - [ ] Enforce tenant scoping on Phase-1 endpoints

- [ ] Step 6: Frontend MVP pages
  - [ ] Sessions list + create session button
  - [ ] QR modal + QR polling (2s interval)
  - [ ] Connected status UI transition
  - [ ] Message send UI calling backend only

- [ ] Step 7: Manual end-to-end local test
  - [ ] create session
  - [ ] fetch QR
  - [ ] scan to connect
  - [ ] send message

- [ ] Step 8: Defer non-MVP items
  - [ ] DB persistence + migrations
  - [ ] Redis + BullMQ queues/workers
  - [ ] Horizontal scaling architecture
  - [ ] Advanced audit/analytics/webhooks/billing

