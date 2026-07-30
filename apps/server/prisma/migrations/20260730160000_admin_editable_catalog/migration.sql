-- The owner can now rename categories and re-price credit packages from the admin
-- panel. Both are also written by the seed, which would silently undo those edits on
-- the next content deploy — so each row records whether an admin has taken it over.
-- The seed skips the owned fields (name / price) for any row flagged here.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "adminEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "adminEdited" BOOLEAN NOT NULL DEFAULT false;
