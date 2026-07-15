export async function broadcastNotification(
  supabase: any,
  title: string,
  message: string,
  link: string | null = null,
  targetOrganizationId: string | null = null,
) {
  let query = supabase.from("profiles").select("id, organization_id").eq("is_active", true);
  if (targetOrganizationId) {
    query = query.eq("organization_id", targetOrganizationId);
  }
  const { data: profiles, error } = await query;
  if (error || !profiles || profiles.length === 0) return;

  const notifications = profiles.map((p: any) => ({
    id: randomUUID(),
    organization_id: p.organization_id,
    user_id: p.id,
    title,
    message,
    is_read: false,
    link,
  }));

  const { error: notifError } = await supabase.from("notifications").insert(notifications);
  if (notifError) console.error("Failed to insert notifications:", notifError);
}

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .gte("created_at", fortyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch notifications: " + error.message);
    return data || [];
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error("Failed to delete notification: " + error.message);
    return { success: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error("Failed to mark notification as read: " + error.message);
    return { success: true };
  });
