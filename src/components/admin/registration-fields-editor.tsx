"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  philippinesPhoneNumberLength,
  type RegistrationField,
} from "@/lib/registration";

export function RegistrationFieldsEditor({
  prefix,
  enabled,
  fields: initialFields,
  deadline,
  capacity,
}: {
  prefix: string;
  enabled: boolean;
  fields: RegistrationField[];
  deadline: string | null;
  capacity: number | null;
}) {
  const [fields, setFields] = useState(initialFields);

  function updateField(
    id: string,
    changes: Partial<RegistrationField>,
  ) {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Event registration</h3>

      <Field
        className="flex-row items-start gap-3"
        orientation="horizontal"
      >
        <input
          className="mt-1 size-4 accent-primary"
          defaultChecked={enabled}
          id={`${prefix}-registration-enabled`}
          name="registration_enabled"
          type="checkbox"
        />
        <FieldLabel htmlFor={`${prefix}-registration-enabled`}>
          Accept registrations on the public website
        </FieldLabel>
      </Field>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${prefix}-registration-deadline`}>
            Registration deadline (optional)
          </FieldLabel>
          <Input
            defaultValue={deadline ?? ""}
            id={`${prefix}-registration-deadline`}
            name="registration_deadline"
            type="date"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-registration-capacity`}>
            Maximum participants (optional)
          </FieldLabel>
          <Input
            defaultValue={capacity ?? ""}
            id={`${prefix}-registration-capacity`}
            min={1}
            name="registration_capacity"
            placeholder="No limit"
            type="number"
          />
        </Field>
      </FieldGroup>

      <input
        name="registration_fields"
        type="hidden"
        value={JSON.stringify(fields)}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Form fields <span className="text-muted-foreground">({fields.length}/20)</span>
          </p>
          <Button
            disabled={fields.length >= 20}
            onClick={() =>
              setFields((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  label: "New question",
                  type: "short_text",
                  required: false,
                  phoneDigitsOnly: false,
                },
              ])
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add field
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm leading-6 text-muted-foreground">
            Add at least one field before enabling registration. You can make
            fields optional or required individually.
          </p>
        )}

        {fields.map((field, index) => {
          const fieldPrefix = `${prefix}-registration-field-${field.id}`;

          return (
            <FieldSet
              className="rounded-lg border border-border bg-background p-4"
              key={field.id}
            >
              <div className="flex items-center justify-between gap-3">
                <FieldLegend variant="label">Field {index + 1}</FieldLegend>
                <Button
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() =>
                    setFields((current) =>
                      current.filter((entry) => entry.id !== field.id),
                    )
                  }
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${fieldPrefix}-label`}>
                    Question or label
                  </FieldLabel>
                  <Input
                    id={`${fieldPrefix}-label`}
                    maxLength={80}
                    onChange={(event) =>
                      updateField(field.id, { label: event.target.value })
                    }
                    placeholder="e.g. Full name"
                    value={field.label}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${fieldPrefix}-type`}>
                    Answer type
                  </FieldLabel>
                  <select
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                    id={`${fieldPrefix}-type`}
                    onChange={(event) => {
                      const type = event.target
                        .value as RegistrationField["type"];
                      const choiceType = [
                        "select",
                        "checkboxes",
                        "multiple_choice",
                      ].some((choice) => choice === type);
                      updateField(field.id, {
                        type,
                        phoneDigitsOnly:
                          type === "phone" ? field.phoneDigitsOnly : false,
                        options:
                          choiceType
                            ? field.options?.length
                              ? field.options
                              : ["Option 1", "Option 2"]
                            : undefined,
                      });
                    }}
                    value={field.type}
                  >
                    <optgroup label="Text Inputs">
                      <option value="short_text">Short answer</option>
                      <option value="long_text">Paragraph</option>
                    </optgroup>
                    <optgroup label="Pre-formatted Inputs">
                      <option value="email">Email address</option>
                      <option value="phone">Phone number</option>
                      <option value="date">Date</option>
                      <option value="time">Time</option>
                    </optgroup>
                    <optgroup label="Numbers only">
                      <option value="number">Whole number (digits only)</option>
                    </optgroup>
                    <optgroup label="Selection Elements">
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="select">Dropdown</option>
                      <option value="checkboxes">Checkboxes</option>
                      <option value="checkbox">Checkbox (single agreement)</option>
                    </optgroup>
                    <optgroup label="Files">
                      <option value="file_upload">File upload</option>
                    </optgroup>
                  </select>
                </Field>

                {["select", "checkboxes", "multiple_choice"].includes(
                  field.type,
                ) && (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`${fieldPrefix}-options`}>
                      Options (one per line)
                    </FieldLabel>
                    <Textarea
                      className="min-h-20"
                      id={`${fieldPrefix}-options`}
                      maxLength={1600}
                      onChange={(event) =>
                        updateField(field.id, {
                          options: event.target.value
                            .split("\n")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      value={field.options?.join("\n") ?? ""}
                    />
                  </Field>
                )}

                {field.type === "file_upload" && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    One PDF, JPG, or PNG file, up to 5 MB. Files are private
                    and available only to administrators.
                  </p>
                )}
                {field.type === "phone" && (
                  <Field
                    className="flex-row items-start gap-3 sm:col-span-2"
                    orientation="horizontal"
                  >
                    <input
                      checked={field.phoneDigitsOnly}
                      className="mt-1 size-4 accent-primary"
                      id={`${fieldPrefix}-phone-digits-only`}
                      onChange={(event) =>
                        updateField(field.id, {
                          phoneDigitsOnly: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <FieldLabel htmlFor={`${fieldPrefix}-phone-digits-only`}>
                      Accept digits only
                    </FieldLabel>
                    <p className="text-sm text-muted-foreground">
                      When enabled, participants enter exactly{" "}
                      {philippinesPhoneNumberLength} digits, such as
                      0912345678.
                    </p>
                  </Field>
                )}
                {field.type === "number" && (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Participants can enter digits only (whole numbers, up to 20
                    digits).
                  </p>
                )}

                <Field className="flex-row items-center gap-3" orientation="horizontal">
                  <input
                    checked={field.required}
                    className="size-4 accent-primary"
                    id={`${fieldPrefix}-required`}
                    onChange={(event) =>
                      updateField(field.id, { required: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <FieldLabel htmlFor={`${fieldPrefix}-required`}>
                    Required
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>
          );
        })}
      </div>
    </section>
  );
}
