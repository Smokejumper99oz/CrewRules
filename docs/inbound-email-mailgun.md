# Inbound Email — Mailgun Setup

## Route

Create one route in Mailgun:

| Field | Value |
|-------|-------|
| **Expression** | `match_recipient(".*@import.crewrules.com")` |
| **Action** | Forward → `https://crewrules.com/api/inbound-email` |
| **Header** | `x-inbound-secret: <your INBOUND_EMAIL_WEBHOOK_SECRET>` |

Use the value from `.env.local` (`INBOUND_EMAIL_WEBHOOK_SECRET`) for the header — do not use a literal placeholder.
