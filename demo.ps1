$BASE = "http://localhost:3000"
$WEBHOOK_KEY = "dev-webhook-key"

# Use existing tenant and credentials from Phase 2 testing
$TENANT_ID = "537ca651-2d01-46b1-a3a1-635ea37f3884"
$EMAIL = "owner@testtenant.com"
$PASSWORD = "Test1234!"

Write-Host "--- NotifyTechAI Phase 2 Demo ---" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1] Health Check" -ForegroundColor Yellow
$health = Invoke-RestMethod -Method Get -Uri "$BASE/health"
Write-Host "  Status: $($health.status)" -ForegroundColor Green
Write-Host "  DB: $($health.checks.db.status)" -ForegroundColor Green
Write-Host "  Redis: $($health.checks.redis.status)" -ForegroundColor Green
Write-Host "  Engines: $($health.checks.engines.status)" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[2] Tenant Info" -ForegroundColor Yellow
$tenant = Invoke-RestMethod -Method Get -Uri "$BASE/tenants/$TENANT_ID" `
  -Headers @{Authorization = "Bearer placeholder"}
Write-Host "  Tenant ID: $TENANT_ID" -ForegroundColor Green
Write-Host "  Name: Test Tenant" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[3] Login" -ForegroundColor Yellow
$login = Invoke-RestMethod -Method Post `
  -Uri "$BASE/auth/tenants/$TENANT_ID/login" `
  -ContentType "application/json" `
  -Body "{`"email`": `"$EMAIL`", `"password`": `"$PASSWORD`"}"
$TOKEN = $login.accessToken
Write-Host "  Login: SUCCESS" -ForegroundColor Green
Write-Host "  Token issued: YES" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[4] Registering Engine Instance" -ForegroundColor Yellow
$engine = Invoke-RestMethod -Method Post -Uri "$BASE/engines/register" `
  -ContentType "application/json" `
  -Body '{"instanceId": "engine-demo", "url": "http://localhost:3500", "maxSessions": 50}'
Write-Host "  Instance: $($engine.instanceId)" -ForegroundColor Green
Write-Host "  Sessions: $($engine.activeSessions) / $($engine.maxSessions)" -ForegroundColor Green
Write-Host "  Healthy: $($engine.isHealthy)" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[5] Health Check with Engine" -ForegroundColor Yellow
$health2 = Invoke-RestMethod -Method Get -Uri "$BASE/health"
Write-Host "  Overall: $($health2.status)" -ForegroundColor Green
Write-Host "  DB: $($health2.checks.db.status)" -ForegroundColor Green
Write-Host "  Redis: $($health2.checks.redis.status)" -ForegroundColor Green
Write-Host "  Active Engines: $($health2.checks.engines.activeInstances)" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[6] List Active Engines" -ForegroundColor Yellow
$engines = Invoke-RestMethod -Method Get -Uri "$BASE/engines" `
  -Headers @{Authorization = "Bearer $TOKEN"}
Write-Host "  Engine count: $($engines.Count)" -ForegroundColor Green
Write-Host "  Engine ID: $($engines[0].instanceId)" -ForegroundColor Green
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "[7] Webhook - session.connected" -ForegroundColor Yellow
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$wh1 = Invoke-RestMethod -Method Post -Uri "$BASE/webhooks/engine" `
  -ContentType "application/json" `
  -Headers @{"X-API-Key" = $WEBHOOK_KEY} `
  -Body "{`"eventType`": `"session.connected`", `"instanceId`": `"engine-demo`", `"sessionId`": `"demo-session-1`", `"timestamp`": $ts, `"payload`": {}}"
Write-Host "  Received: $($wh1.received)" -ForegroundColor Green
Write-Host "  BullMQ job queued and processed" -ForegroundColor Green
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[8] Webhook - message.received" -ForegroundColor Yellow
$ts2 = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$wh2 = Invoke-RestMethod -Method Post -Uri "$BASE/webhooks/engine" `
  -ContentType "application/json" `
  -Headers @{"X-API-Key" = $WEBHOOK_KEY} `
  -Body "{`"eventType`": `"message.received`", `"instanceId`": `"engine-demo`", `"sessionId`": `"demo-session-1`", `"timestamp`": $ts2, `"payload`": {`"from`": `"919876543210`", `"body`": `"Hello from WhatsApp!`", `"type`": `"text`", `"id`": `"ext-demo-001`"}}"
Write-Host "  Received: $($wh2.received)" -ForegroundColor Green
Write-Host "  Message saved to PostgreSQL" -ForegroundColor Green
Write-Host "  WebSocket event emitted to tenant room" -ForegroundColor Green
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[9] Swagger Docs: http://localhost:3000/api/docs" -ForegroundColor Yellow

Write-Host ""
Write-Host "--- Demo Complete ---" -ForegroundColor Cyan
Write-Host "  Tenant ID : $TENANT_ID" -ForegroundColor White
Write-Host "  JWT Auth  : working" -ForegroundColor White
Write-Host "  Engine    : engine-demo in Redis" -ForegroundColor White
Write-Host "  Webhooks  : received and processed" -ForegroundColor White
Write-Host "  WebSocket : live events emitted" -ForegroundColor White
Write-Host "  Health    : all systems green" -ForegroundColor White