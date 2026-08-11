"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { createClass, listClasses } from "@/lib/admin";
import { CLASS_CODE_MAX, CLASS_NAME_MAX, classSchema } from "@/lib/schemas";
import type { ClassValues } from "@/lib/schemas";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 5;

export default function AdminClassesPage() {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Two fields, so the create form lives inline behind a toggle rather than on its own route. A whole
  // page navigation for a name and a code would be more clicks for less context.
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) =>
      listClasses({ page, pageSize: DEFAULT_PAGE_SIZE, sortBy: "code", sortDir: "asc" }, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [page, reloadKey],
  );

  const { data, error, loading } = useAsync(loader);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClassValues>({
    resolver: zodResolver(classSchema),
    mode: "onBlur",
    defaultValues: { name: "", code: "" },
  });

  const onSubmit = async (values: ClassValues) => {
    setFormError(null);

    try {
      await createClass(values);

      reset();
      setShowForm(false);
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      if (caught instanceof ApiError) {
        let matched = false;

        for (const field of ["name", "code"] as const) {
          const message = caught.fieldError(field);
          if (message) {
            setError(field, { message });
            matched = true;
          }
        }

        // A 409 means the code is taken. Case-insensitively — "10a" cannot join "10A" — so the server's
        // sentence is more informative than anything this form could guess.
        if (!matched) setError("code", { message: caught.message });
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="A class holds subjects, the teachers who teach them, and the students enrolled."
        action={
          <Button
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? "Cancel" : "New class"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mb-6 flex max-w-2xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
        >
          {formError && <Alert>{formError}</Alert>}

          <Input
            label="Name"
            required
            maxLength={CLASS_NAME_MAX}
            placeholder="Class 10 - A"
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="Code"
            required
            maxLength={CLASS_CODE_MAX}
            placeholder="10A"
            hint="Letters, digits and hyphens only. Must be unique — codes are compared case-insensitively."
            error={errors.code?.message}
            {...register("code")}
          />

          <div className="mt-2">
            <Button type="submit" loading={isSubmitting}>
              Create class
            </Button>
          </div>
        </form>
      )}

      {error && <Alert className="mb-4">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="A class is the first thing to create. Assignments belong to a class and a subject, so nothing else can be set up until one exists."
          action={<Button onClick={() => setShowForm(true)}>New class</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH>Subjects</TH>
                <TH>Created</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((schoolClass) => (
                  <TR key={schoolClass.id}>
                    <TD className="font-medium text-slate-900">{schoolClass.code}</TD>

                    <TD>{schoolClass.name}</TD>

                    <TD>
                      {/* The list response nests subjects, so no second request is needed to show them. */}
                      {schoolClass.subjects.length === 0 ? (
                        <span className="text-xs text-slate-500">None yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {schoolClass.subjects.map((subject) => (
                            <Badge key={subject.id} tone="info">
                              {subject.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TD>

                    <TD className="whitespace-nowrap">{formatDate(schoolClass.createdAt)}</TD>

                    <TD align="right">
                      <Link href={`/admin/classes/${schoolClass.id}`}>
                        <Button size="sm" variant="secondary">
                          Manage
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
