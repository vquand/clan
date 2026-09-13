export const BASELINE_MIGRATION_FILE = '001_baseline.sql';

export function isCurrentSchema(schema) {
  return Boolean(
    schema?.has_members &&
    schema.has_member_parents &&
    schema.has_member_spouses &&
    schema.has_events &&
    schema.has_event_members &&
    schema.has_event_solar_dates &&
    schema.has_clan_locations &&
    schema.has_member_avatar_image &&
    schema.has_clan_head_flags &&
    schema.has_event_location,
  );
}
