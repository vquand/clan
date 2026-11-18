// Keep the shared API's tagged queries lazy so D1 can commit each write batch atomically.
export function createD1Database(binding) {
  const database = (strings, ...values) => {
    const statement = binding
      .prepare(strings.join('?'))
      .bind(
        ...values.map((value) =>
          typeof value === 'boolean' ? Number(value) : (value ?? null),
        ),
      );
    let result;
    return {
      statement,
      // oxlint-disable-next-line unicorn/no-thenable -- Query execution must wait for await or transaction().
      then(resolve, reject) {
        result ??= statement.all().then(({ results }) => results);
        return result.then(resolve, reject);
      },
    };
  };
  database.transaction = async (queries) =>
    (await binding.batch(queries.map((query) => query.statement))).map(
      ({ results }) => results,
    );
  return database;
}

export function createD1LoginLimiter(binding, now = Date.now) {
  const key = (request, scope) => `${scope}:${request.socket.remoteAddress}`;
  return {
    async retryAfter(request, scope) {
      const row = await binding
        .prepare('SELECT count, expires_at FROM login_attempts WHERE key = ?')
        .bind(key(request, scope))
        .first();
      return row && row.count >= 10 && row.expires_at > now()
        ? Math.ceil((row.expires_at - now()) / 1000)
        : 0;
    },
    async recordFailure(request, scope) {
      const timestamp = now();
      await binding.batch([
        binding
          .prepare('DELETE FROM login_attempts WHERE expires_at <= ?')
          .bind(timestamp),
        binding
          .prepare(`
          INSERT INTO login_attempts (key, count, expires_at) VALUES (?, 1, ?)
          ON CONFLICT (key) DO UPDATE SET count = login_attempts.count + 1
        `)
          .bind(key(request, scope), timestamp + 15 * 60 * 1000),
      ]);
    },
    async clear(request, scope) {
      await binding
        .prepare('DELETE FROM login_attempts WHERE key = ?')
        .bind(key(request, scope))
        .run();
    },
  };
}
