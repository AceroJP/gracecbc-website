import { z } from "zod";

export const registrationFieldTypes = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "select",
  "checkbox",
] as const;

export const registrationFieldSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(80),
    type: z.enum(registrationFieldTypes),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .superRefine((field, context) => {
    if (field.type === "select" && (!field.options || field.options.length < 2)) {
      context.addIssue({
        code: "custom",
        message: "Dropdown fields need at least two options.",
        path: ["options"],
      });
    }

    if (
      field.type === "select" &&
      new Set(field.options?.map((option) => option.toLowerCase())).size !==
        field.options?.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Dropdown options must be unique.",
        path: ["options"],
      });
    }
  });

export const registrationFieldsSchema = z
  .array(registrationFieldSchema)
  .max(20)
  .superRefine((fields, context) => {
    if (new Set(fields.map((field) => field.id)).size !== fields.length) {
      context.addIssue({
        code: "custom",
        message: "Registration fields must have unique identifiers.",
      });
    }
  });

export type RegistrationField = z.infer<typeof registrationFieldSchema>;

export function parseRegistrationFields(value: unknown): RegistrationField[] {
  const parsed = registrationFieldsSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("The event registration form is invalid.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
