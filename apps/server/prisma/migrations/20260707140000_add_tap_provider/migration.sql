-- Add Tap Payments (tap.company) to the PaymentProvider enum.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'TAP';
