UPDATE "store_settings"
SET "socialLinks" = '{"facebook":"https://www.facebook.com/share/19N5mZgVt4/?mibextid=wwXIfr","instagram":"https://www.instagram.com/retro._.walaa?stkn=ZXQwYzl1anF5eGR6","tiktok":"https://www.tiktok.com/@epic_vanskap?_r=1&_t=ZS-99rOqRbSjx7"}'::jsonb
WHERE id = 'default' AND ("socialLinks" IS NULL OR "socialLinks"::text = 'null');
