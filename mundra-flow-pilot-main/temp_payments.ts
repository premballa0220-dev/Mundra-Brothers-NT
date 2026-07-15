import { getAdminPaymentMonitoringHandler, recordPaymentAdminHandler } from "./temp_handlers";
export const getAdminPaymentMonitoring = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(getAdminPaymentMonitoringHandler);

export const recordPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      purchaseOrderId: z.string().uuid(),
      amount: z.number().positive(),
      paymentDate: z.string(),
      referenceNumber: z.string(),
      paymentMode: z.string(),
    }),
  )
  .handler(recordPaymentAdminHandler);
