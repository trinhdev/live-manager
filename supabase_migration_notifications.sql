-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    platform TEXT,
    "targetUserIds" TEXT[] DEFAULT NULL,
    "createdBy" TEXT,
    "createdAt" BIGINT NOT NULL,
    "readBy" TEXT[] DEFAULT '{}'::TEXT[]
);

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Set up Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read notifications (The app logic filters them, but for strict RLS we can conditionally allow if targetUserIds is null or contains the user's id. Since we don't use Supabase Auth directly in this app for staff login but instead use a custom "currentUser" ID from localStorage for simplicity, we'll allow all SELCT operations and let the frontend filter).
CREATE POLICY "Enable read access for all users" ON public.notifications FOR SELECT USING (true);

-- Allow anyone to insert (We trust the client for creating requests and notifications in this context)
CREATE POLICY "Enable insert for all users" ON public.notifications FOR INSERT WITH CHECK (true);

-- Allow anyone to update (Specifically for marking as read, we need to update readBy arrays)
CREATE POLICY "Enable update for all users" ON public.notifications FOR UPDATE USING (true);

-- Allow anyone to delete (Optional, for cleanup)
CREATE POLICY "Enable delete for all users" ON public.notifications FOR DELETE USING (true);
