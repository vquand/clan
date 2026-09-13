export function getClanDisplayName(
  env: { CLAN_DISPLAY_NAME?: string } = {
    CLAN_DISPLAY_NAME: process.env.CLAN_DISPLAY_NAME,
  },
) {
  const displayName = env.CLAN_DISPLAY_NAME?.trim();
  return displayName || undefined;
}
