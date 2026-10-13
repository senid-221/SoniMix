/**
 * Atomic PostgreSQL queue statements for shared serverless workers.
 */
export const CLAIM_NEXT_JOB_SQL = `
  WITH candidate AS (
    SELECT id FROM jobs
    WHERE (state = 'queued' AND available_at <= $1)
       OR (state = 'processing' AND locked_at < $2)
    ORDER BY available_at, created_at
    FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE jobs AS j
  SET state = 'processing', attempts = j.attempts + 1, locked_at = $1, locked_by = $3,
      updated_at = to_char(to_timestamp($1 / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM candidate WHERE j.id = candidate.id
  RETURNING j.id, j.user_id, j.type, j.state, j.attempts, j.payload, j.created_at, j.updated_at
`;

export const COMPLETE_JOB_SQL = `
  UPDATE jobs SET state = 'completed', payload = $2::jsonb, locked_at = NULL, locked_by = NULL, error = NULL, updated_at = $3
  WHERE id = $1 AND state = 'processing' AND locked_by = $4 RETURNING id
`;

export const RETRY_OR_FAIL_JOB_SQL = `
  UPDATE jobs
  SET state = CASE WHEN attempts >= $4 THEN 'failed' ELSE 'queued' END,
      available_at = CASE WHEN attempts >= $4 THEN available_at ELSE $2 END,
      error = left($3, 2000), locked_at = NULL, locked_by = NULL,
      updated_at = to_char(to_timestamp($2 / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE id = $1 AND state = 'processing' AND locked_by = $5
  RETURNING id, state, attempts
`;

export function retryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.min(8, Math.floor(attempt)));
  return Math.min(15 * 60 * 1000, 1000 * 2 ** safeAttempt);
}
