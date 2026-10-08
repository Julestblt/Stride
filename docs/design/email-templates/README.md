# Stride Auth email proposals

Open [preview.html](preview.html) in a browser to review the three proposed transactional emails. The preview embeds the same standalone HTML files intended for Supabase.

| Supabase template | Subject                       | HTML                                   |
| ----------------- | ----------------------------- | -------------------------------------- |
| Confirm sign up   | Confirm your email for Stride | [confirmation.html](confirmation.html) |
| Reset password    | Reset your Stride password    | [recovery.html](recovery.html)         |
| Magic link        | Your Stride sign-in link      | [magic-link.html](magic-link.html)     |

The designs use the Night Track palette, restrained Volt actions, and compact technical labels. The wordmark uses two separate Volt slashes. The font stacks start with Stride's Instrument Sans, Barlow Condensed, and IBM Plex Mono, then fall back to common system fonts because email clients do not reliably load the app's self-hosted fonts. The templates use table layout and inline styles for broad email client support.

All links use Supabase's `{{ .ConfirmationURL }}` variable, preserving the configured redirect and the current PKCE flow. The copy reminds users to open the link in the same browser and profile where they requested it. The preview does not send email or change Supabase settings.

To apply a design later, configure a sender and custom SMTP in Supabase Authentication → SMTP Settings, then copy its HTML and subject into the matching entry under Authentication → Email Templates. Keep the project's Site URL and Redirect URLs aligned with `docs/architecture/authentication.md`.

Send a fresh message after saving and inspect it in the email clients used by the team. A browser preview cannot verify how every email client renders the message. Open each test link once, in the same browser and profile that requested it; a previously issued link may already be expired or consumed.
