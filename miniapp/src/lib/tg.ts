export function getStartSid(): string | null {
    const w = window as any;
    const tg = w?.Telegram?.WebApp;
    const sp = tg?.initDataUnsafe?.start_param;
    if (sp && typeof sp === "string" && sp.startsWith("sid_")) return sp.slice(4);
    return null;
  }
  
  export function buildTgDeepLink(botUsername: string | undefined | null, sid: string): string | null {
    if (!botUsername) return null;
    return `https://t.me/${botUsername}?startapp=sid_${encodeURIComponent(sid)}`;
  }
  
  export function buildBrowserPreview(sid: string): string {
    return `/respond?sid=${encodeURIComponent(sid)}`;
  }
  