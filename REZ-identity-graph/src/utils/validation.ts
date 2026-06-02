import Joi from 'joi';

/**
 * Validate data against a Joi schema
 */
export async function validateRequest<T>(
  schema: Joi.Schema,
  data: unknown
): Promise<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
  }
  return value as T;
}
