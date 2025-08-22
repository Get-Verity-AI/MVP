export const tg = (window as any).Telegram?.WebApp;

export function initTg() {
  try {
    tg?.ready?.();
  } catch {}
}

export function founderIdentityEmail(): string | null {
  // For now founders type email in the wizard (backend requires it)
  return null;
}

export function reviewerIdentity(): { tg_id?: number; username?: string } {
  const user = tg?.initDataUnsafe?.user;
  return { tg_id: user?.id, username: user?.username };
}
