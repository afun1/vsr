-- Set user role to admin in Supabase
-- Run this in your Supabase SQL Editor

-- Update the role for the user with email john+1@tpnlife.com to admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'john+1@tpnlife.com';

-- If that doesn't work, try updating by user ID
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = 'e1144708-1038-478a-a883-57998dff9838';

-- Check the result
SELECT id, email, role FROM public.profiles WHERE email = 'john+1@tpnlife.com';
