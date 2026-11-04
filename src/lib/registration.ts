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

const emailSchema = z.email();
const phoneSchema = /^[+]?[0-9\s().-]{5,32}$/;

export function validateRegistrationAnswers(
  formData: FormData,
  fields: RegistrationField[],
): Record<string, string | boolean> | null {
  const answers: Record<string, string | boolean> = {};

  for (const field of fields) {
    const values = formData.getAll(field.id);

    if (field.type === "checkbox") {
      if (values.length > 1 || (values.length === 1 && values[0] !== "true")) {
        return null;
      }

      const checked = values.length === 1;
      if (field.required && !checked) {
        return null;
      }

      answers[field.id] = checked;
      continue;
    }

    if (
      values.length > 1 ||
      (values.length === 1 && typeof values[0] !== "string")
    ) {
      return null;
    }

    const value = typeof values[0] === "string" ? values[0].trim() : "";
    const maxLength =
      field.type === "long_text"
        ? 2000
        : field.type === "email"
          ? 254
          : field.type === "phone"
            ? 32
            : field.type === "select"
              ? 80
              : 200;

    if ((field.required && !value) || value.length > maxLength) {
      return null;
    }

    if (
      field.type === "email" &&
      value &&
      !emailSchema.safeParse(value).success
    ) {
      return null;
    }

    if (field.type === "phone" && value && !phoneSchema.test(value)) {
      return null;
    }

    if (field.type === "select" && value && !field.options?.includes(value)) {
      return null;
    }

    answers[field.id] =
      field.type === "email" ? value.toLowerCase() : value;
  }

  return answers;
}

export function parseRegistrationFields(value: unknown): RegistrationField[] {
  const parsed = registrationFieldsSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("The event registration form is invalid.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
