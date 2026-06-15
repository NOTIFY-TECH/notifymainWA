import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EngineClientService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Rewrites localhost media URLs so the engine (running in WSL2 or Docker)
   * can reach the backend. Single source of truth for this rewrite —
   * update here when the networking setup changes (e.g. host.docker.internal).
   */
  toEngineAccessibleUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    const backendUrlForEngine =
      this.config.get<string>('BACKEND_URL_FOR_ENGINE') ??
      'http://172.31.112.1:3001';
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        const engineHost = new URL(backendUrlForEngine);
        parsed.hostname = engineHost.hostname;
        parsed.port = engineHost.port;
        parsed.protocol = engineHost.protocol;
        return parsed.toString();
      }
      return url;
    } catch {
      return url;
    }
  }
}
