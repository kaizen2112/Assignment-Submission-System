"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { ApiError } from "@/lib/api";
import { addSubject } from "@/lib/admin";
import { SUBJECT_NAME_MAX, subjectSchema } from "@/lib/schemas";
import type { SubjectValues } from "@/lib/schemas";
import type { Subject } from "@/types/api";

// Subjects come in on the parent's class response — GET /admin/classes nests them — so this component
// never fetches. It reports upwards after a successful add and lets the parent refetch, which keeps one
// source of truth for what the class contains.
//
// There is no delete: the API has no endpoint for it, because a subject with assignments against it
// cannot be removed without destroying student work. Saying nothing about that would be worse than the
// note in the description.
export function ClassSubjects({
  classId,
  subjects,
  onChanged,
}: {
  classId: string;
  subjects: Subject[];
  onChanged: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubjectValues>({
    resolver: zodResolver(subjectSchema),
    mode: "onBlur",
    defaultValues: { name: "" },
  });

  const onSubmit = async (values: SubjectValues) => {
    setFormError(null);

    try {
      await addSubject(classId, values);

      reset();
      onChanged();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldMessage = caught.fieldError("name");

        // A 409 means this class already has a subject by that name. Uniqueness is per class, so
        // "Mathematics" can exist in 10A and 10B — the message goes on the field either way.
        setError("name", { message: fieldMessage ?? caught.message });
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  return (
    <Section
      title="Subjects"
      description="A teacher is granted one subject in one class at a time, so subjects come first."
    >
      {formError && <Alert className="mb-4">{formError}</Alert>}

      <div className="mb-4">
        {subjects.length === 0 ? (
          <p className="text-sm text-slate-500">
            No subjects yet. Add one before assigning a teacher.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((subject) => (
              <Badge key={subject.id} tone="info">
                {subject.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-wrap items-start gap-3 border-t border-slate-100 pt-4"
      >
        <div className="w-64">
          <Input
            label="Add a subject"
            required
            maxLength={SUBJECT_NAME_MAX}
            placeholder="Mathematics"
            error={errors.name?.message}
            {...register("name")}
          />
        </div>

        {/* mt-6 lines the button up with the input rather than with its label. */}
        <Button type="submit" className="mt-6" loading={isSubmitting}>
          Add subject
        </Button>
      </form>
    </Section>
  );
}
