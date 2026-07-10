export const nowIso = () => new Date().toISOString();

export const uuid = () => crypto.randomUUID();

export const requireBindings = (env) => {
  if (!env.DB) throw new Error("D1 binding DB is missing");
  if (!env.ALBUM_BUCKET) throw new Error("R2 binding ALBUM_BUCKET is missing");
};

export const getSettings = async (env) => {
  let row = await env.DB.prepare("SELECT * FROM album_security_settings WHERE id = 1").first();
  if (!row) {
    const now = nowIso();
    await env.DB.prepare(
      `INSERT INTO album_security_settings
       (id, family_password_version, family_access_enabled, family_session_days, created_at, updated_at)
       VALUES (1, 1, 0, 30, ?, ?)`,
    )
      .bind(now, now)
      .run();
    row = await env.DB.prepare("SELECT * FROM album_security_settings WHERE id = 1").first();
  }
  return row;
};

export const publicSettings = (settings) => ({
  passwordSet: Boolean(settings.family_password_hash),
  accessEnabled: Boolean(settings.family_access_enabled),
  sessionDays: Number(settings.family_session_days || 30),
  passwordUpdatedAt: settings.password_updated_at || null,
});

export const eventSummarySql = (whereSql) => `
  SELECT
    e.*,
    SUM(CASE WHEN m.media_type = 'image' AND m.is_hidden = 0 AND m.deleted_at IS NULL THEN 1 ELSE 0 END) AS photo_count,
    SUM(CASE WHEN m.media_type = 'video' AND m.is_hidden = 0 AND m.deleted_at IS NULL THEN 1 ELSE 0 END) AS video_count
  FROM album_events e
  LEFT JOIN album_media m ON m.event_id = e.id
  ${whereSql}
  GROUP BY e.id
`;
