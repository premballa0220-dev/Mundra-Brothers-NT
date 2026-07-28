import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPoFormats, upsertPoFormat } from "@/lib/api/po-formats.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function PoFormatManager({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [templateText, setTemplateText] = useState("");

  const { data: formats, isLoading } = useQuery({
    queryKey: ["po_formats", organizationId],
    queryFn: () => getPoFormats({ data: { organization_id: organizationId } })
  });

  const activeFormat = formats?.[0];

  // Pre-fill state when the saved format loads (or changes to a different client).
  useEffect(() => {
    if (activeFormat) {
      const schema = activeFormat.template_schema as { template_text?: string } | null;
      setTemplateText(schema?.template_text || "");
    } else {
      setTemplateText("");
    }
  }, [activeFormat]);

  const upsertMutation = useMutation({
    mutationFn: (variables: { templateText: string }) => {
      const payload = {
        organization_id: organizationId,
        format_name: "Default PO Format",
        template_schema: {
          template_text: variables.templateText,
        }
      };
      if (activeFormat) {
        return upsertPoFormat({ data: { id: activeFormat.id, ...payload } });
      } else {
        return upsertPoFormat({ data: payload });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["po_formats", organizationId] });
      toast.success("PO Format saved successfully");
    },
    onError: (e) => {
      toast.error("Failed to save PO format: " + e.message);
    }
  });



  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="space-y-4 border p-4 rounded-md">
        <h4 className="font-semibold text-md">Client PO Format</h4>
        <p className="text-sm text-muted-foreground">
          Provide a default template text. When creating a PO for this client, this format will be used.
        </p>

        <div className="space-y-2">
          <Label>Default PO Text Template</Label>
          <Textarea 
            placeholder="Type your default text here... e.g. Dear Vendor, Please supply the following items..."
            rows={8}
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
          />
        </div>

        <Button 
          onClick={() => upsertMutation.mutate({ templateText })}
          disabled={upsertMutation.isPending}
        >
          {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Format
        </Button>
      </div>
    </div>
  );
}
