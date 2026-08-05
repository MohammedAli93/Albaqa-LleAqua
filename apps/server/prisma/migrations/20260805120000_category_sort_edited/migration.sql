-- The 2026-08-05 restructure makes ORDER part of what the client specified
-- (المتشابه والمختلف first, then نكهة محلية, then الرياضة…), and the admin panel now
-- lets the owner reorder groups and categories with the ↑/↓ buttons.
--
-- The seed also writes `sortOrder` from prisma/taxonomy.ts, which would snap a
-- hand-ordered list back to the code's order on the next content deploy. So each row
-- records whether an admin has taken its position over; the seed skips those.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sortEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CategoryGroup" ADD COLUMN IF NOT EXISTS "sortEdited" BOOLEAN NOT NULL DEFAULT false;
