export const getJournalFeed = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.orgType !== "mundra") {
      throw new Error("Unauthorized: Only mundra admin can view journal feed.");
    }
    const supabase = createSupabaseAdminClient();
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, action, table_name, created_at, user_id")
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Failed to fetch journal feed: " + error.message);
    }

    const userIds = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean)));
    
    let profilesMap = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    return (logs || []).map((log: any) => {
      const profile = profilesMap.get(log.user_id);
      return {
        ...log,
        user_name: profile?.full_name || profile?.email || "System/Unknown",
      };
    });
  });
