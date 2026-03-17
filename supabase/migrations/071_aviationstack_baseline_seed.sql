-- One-time baseline: align Super Admin with provider dashboard for period before we started logging.
-- Inserts only the delta needed to reach 444; no double counting if live rows already exist.
-- Uses same period logic as getAviationStackUsageMetrics() (current UTC calendar month).
WITH period AS (
  SELECT
    date_trunc('month', now() AT TIME ZONE 'UTC')::timestamptz AS period_start,
    (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month' - interval '1 second')::timestamptz AS period_end
),
current_sum AS (
  SELECT COALESCE(SUM(request_count), 0)::bigint AS total
  FROM public.aviationstack_usage
  WHERE requested_at >= (SELECT period_start FROM period)
    AND requested_at <= (SELECT period_end FROM period)
),
baseline_needed AS (
  SELECT GREATEST(444 - (SELECT total FROM current_sum), 0)::integer AS amount
)
INSERT INTO public.aviationstack_usage (requested_at, endpoint, request_count)
SELECT
  (SELECT period_start FROM period),
  'baseline/manual-seed',
  (SELECT amount FROM baseline_needed)
WHERE (SELECT amount FROM baseline_needed) > 0;
