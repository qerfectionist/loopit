-- Create user_blocks table
CREATE TABLE public.user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(blocker_id, blocked_id),
    CHECK(blocker_id <> blocked_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Block policies
-- A user can see blocks they created.
CREATE POLICY "Users can view their own blocks" ON public.user_blocks
    FOR SELECT USING (auth.uid() = blocker_id);

-- A user can block another user.
CREATE POLICY "Users can create blocks" ON public.user_blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- A user can unblock another user.
CREATE POLICY "Users can delete their blocks" ON public.user_blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- Create reports table
CREATE TABLE public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    description TEXT,
    related_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    related_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    related_exchange_id UUID REFERENCES public.exchanges(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Report policies
-- A user can see their own reports.
CREATE POLICY "Users can view their own reports" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- A user can create a report.
CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);
