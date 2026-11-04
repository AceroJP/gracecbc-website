import { z } from "zod";

export const registrationFieldTypes = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "select",
  "checkbox",
  "checkboxes",
  "multiple_choice",
  "date",
  "time",
  "file_upload",
] as const;

export const registrationUploadMaxBytes = 5 * 1024 * 1024;
export const registrationFileBucket = "event-registration-files";
export const registrationUploadTypes = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
} as const;

export const registrationUploadAccept = Object.entries(registrationUploadTypes)
  .flatMap(([contentType, extensions]) => [...extensions, contentType])
  .join(",");
export type RegistrationUploadContentType =
  keyof typeof registrationUploadTypes;

export function isRegistrationUploadContentType(
  value: string,
): value is RegistrationUploadContentType {
  return Object.hasOwn(registrationUploadTypes, value);
}

export const registrationFieldSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(80),
    type: z.enum(registrationFieldTypes),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .superRefine((field, context) => {
    if (
      ["select", "checkboxes", "multiple_choice"].includes(field.type) &&
      (!field.options || field.options.length < 2)
    ) {
      context.addIssue({
        code: "custom",
        message: "Choice fields need at least two options.",
        path: ["options"],
      });
    }

    if (
      ["select", "checkboxes", "multiple_choice"].includes(field.type) &&
      new Set(field.options?.map((option) => option.toLowerCase())).size !==
        field.options?.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Choice options must be unique.",
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

export type RegistrationFileAnswer = {
  path: string;
  name: string;
  size: number;
  contentType: string;
};

export type RegistrationAnswer =
  | string
  | boolean
  | string[]
  | RegistrationFileAnswer
  | null;

export function parseRegistrationFileAnswer(
  value: unknown,
): RegistrationFileAnswer | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("path" in value) ||
    !("name" in value) ||
    !("size" in value) ||
    !("contentType" in value) ||
    typeof value.path !== "string" ||
    typeof value.name !== "string" ||
    typeof value.size !== "number" ||
    typeof value.contentType !== "string"
  ) {
    return null;
  }

  return {
    path: value.path,
    name: value.name,
    size: value.size,
    contentType: value.contentType,
  };
}

const emailSchema = z.email();
const phoneSchema = /^[+]?[0-9\s().-]{5,32}$/;
const timeSchema = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getRegistrationUploadExtension(file: File) {
  return getRegistrationUploadExtensionFromMetadata(
    file.name,
    file.type,
    file.size,
  );
}

export function getRegistrationUploadExtensionFromMetadata(
  name: string,
  contentType: string,
  size: number,
) {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  const allowedExtensions =
    registrationUploadTypes[
      contentType as keyof typeof registrationUploadTypes
    ] as readonly string[] | undefined;

  if (
    !allowedExtensions?.includes(extension) ||
    size <= 0 ||
    size > registrationUploadMaxBytes
  ) {
    return null;
  }

  return extension;
}

export async function hasRegistrationUploadSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  if (file.type === "application/pdf") {
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return (
    file.type === "image/png" &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    )
  );
}

export function safeRegistrationFilename(name: string) {
  return (
    name
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 180) || "Uploaded file"
  );
}

export function validateRegistrationAnswers(
  formData: FormData,
  fields: RegistrationField[],
): Record<string, RegistrationAnswer> | null {
  const answers: Record<string, RegistrationAnswer> = {};

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

    if (field.type === "checkboxes") {
      if (values.some((value) => typeof value !== "string")) {
        return null;
      }

      const selected = values as string[];
      if (
        (field.required && selected.length === 0) ||
        new Set(selected).size !== selected.length ||
        selected.some((value) => !field.options?.includes(value))
      ) {
        return null;
      }

      answers[field.id] = selected;
      continue;
    }

    if (field.type === "file_upload") {
      answers[field.id] = "";
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
              : field.type === "date" || field.type === "time"
                ? 16
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

    if (
      ["select", "multiple_choice"].includes(field.type) &&
      value &&
      !field.options?.includes(value)
    ) {
      return null;
    }

    if (field.type === "date" && value && !z.iso.date().safeParse(value).success) {
      return null;
    }

    if (field.type === "time" && value && !timeSchema.test(value)) {
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
