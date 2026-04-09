import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
  })
  .meta({ id: 'HealthResponse' });

export class HealthResponseDto extends createZodDto(healthResponseSchema) {}

export type HealthResponse = z.infer<typeof healthResponseSchema>;
