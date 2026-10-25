const DAY = 24 * 60 * 60 * 1000;
export function configuredDelay(text) {
  const value = text.match(/^publication_delay_days:\s*([^\n]*)$/m)?.[1]?.trim();
  if (value === undefined) return 7;
  if (!/^\d+$/.test(value)) throw Error("Invalid publication_delay_days");
  const days = Number(value);
  if (!Number.isSafeInteger(days)) throw Error("Invalid publication_delay_days");
  return days;
}
export function eligibleAt(publishedAt, delayDays = 7) {
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published) || !Number.isSafeInteger(delayDays) || delayDays < 0)
    throw Error("Invalid publication timing");
  const result = published + delayDays * DAY;
  if (!Number.isFinite(new Date(result).getTime())) throw Error("Invalid publication timing");
  return result;
}
export function publicationReady(publishedAt, { delayDays = 7, now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw Error("Invalid publication clock");
  return now >= eligibleAt(publishedAt, delayDays);
}
