import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import SuperAdminMessageTemplatesEmbedded from "./SuperAdminMessageTemplatesEmbedded";

/**
 * Standalone Message Templates page (`/super-admin/templates`).
 *
 * This page previously read/wrote a separate `notification_templates` table,
 * which meant templates created here never appeared in the Broadcast template
 * picker or the Communications → Templates tab (both of which use
 * `message_templates`). To keep a single source of truth, this page now renders
 * the same `message_templates`-backed manager used everywhere else, wrapped in
 * the super-admin shell. Anything created here shows up in the broadcast picker.
 */
export default function SuperAdminMessageTemplates() {
  return (
    <SuperAdminLayout>
      <SuperAdminMessageTemplatesEmbedded />
    </SuperAdminLayout>
  );
}
