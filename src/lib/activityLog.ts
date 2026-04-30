import { supabase } from "@/integrations/supabase/client";

export type ActivityEntry = {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_label?: string | null;
  details?: Record<string, unknown> | null;
};

/**
 * Fire-and-forget activity logger. Never throws — auditing must not break user actions.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    await supabase.from("activity_log").insert({
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      entity_label: entry.entity_label ?? null,
      details: (entry.details ?? null) as never,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("activity_log insert failed", err);
  }
}
