import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function backfillWallets() {
  console.log("Starting wallet backfill...");

  // 1. Fetch all POs with their payments
  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select("id, organization_id, total_value, payments(amount, status)");

  if (error || !pos) {
    console.error("Failed to fetch POs", error);
    return;
  }

  // 2. Calculate overpayments per organization
  const orgWalletUpdates: Record<string, number> = {};

  for (const po of pos) {
    const amountPaid =
      po.payments
        ?.filter((p: any) => p.status === "approved" || p.status === "verified")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

    const overpayment = amountPaid - po.total_value;

    if (overpayment > 0) {
      if (!orgWalletUpdates[po.organization_id]) {
        orgWalletUpdates[po.organization_id] = 0;
      }
      orgWalletUpdates[po.organization_id] += overpayment;
    }
  }

  console.log("Calculated historical overpayments:");
  console.log(orgWalletUpdates);

  // 3. Apply updates to the database
  for (const [orgId, overpaymentAmount] of Object.entries(orgWalletUpdates)) {
    // Fetch current wallet balance
    const { data: profile } = await supabase
      .from("client_commercial_profiles")
      .select("id, wallet_balance")
      .eq("organization_id", orgId)
      .single();

    if (profile) {
      const newBalance = Number(profile.wallet_balance || 0) + overpaymentAmount;
      const { error: updateError } = await supabase
        .from("client_commercial_profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profile.id);

      if (updateError) {
        console.error(`Failed to update org ${orgId}`, updateError);
      } else {
        console.log(`Updated org ${orgId} with +${overpaymentAmount}. New Balance: ${newBalance}`);
      }
    }
  }

  console.log("Wallet backfill complete.");
}

backfillWallets();
