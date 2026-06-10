export interface EngineInstance {
  instanceId: string;
  url: string;
  maxSessions: number;
  activeSessions: number;
  lastHeartbeat: number;
  isHealthy: boolean;
}
