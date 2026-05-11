-- Add strict safety constraints to reports table

-- 1. Allowed reasons for a report
ALTER TABLE public.reports
ADD CONSTRAINT reports_reason_check
CHECK (reason IN ('spam', 'scam', 'harassment', 'no_show', 'fake_book', 'other'));

-- 2. Allowed statuses for a report
ALTER TABLE public.reports
ADD CONSTRAINT reports_status_check
CHECK (status IN ('open', 'reviewed', 'resolved'));

-- 3. Prevent self-reporting
ALTER TABLE public.reports
ADD CONSTRAINT reports_no_self_report_check
CHECK (reporter_id <> reported_user_id);
