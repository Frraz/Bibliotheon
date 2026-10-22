import type { TaskConfig } from 'payload'
export const deliverEmailTask: TaskConfig<{ input: { deliveryId: string }; output: Record<string, never> }> = {
  slug: 'deliver-email', label: 'Entregar e-mail solicitado', retries: 0,
  inputSchema: [{ name: 'deliveryId', type: 'text', required: true }],
  handler: async ({ input, req }) => {
    const { processDelivery } = await import('../modules/marketing/delivery')
    await processDelivery(req.payload, input.deliveryId)
    return { output: {} }
  },
}
