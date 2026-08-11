"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { deleteUser, listUsers } from "@/lib/admin";
import { useSession } from "@/components/layout/SessionContext";
import { formatDate } from "@/lib/utils";
import type { BadgeTone } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AdminUser, Role } from "@/types/api";

const COLUMNS = 5;

// Roles read as a hierarchy on screen, so they get distinct tones rather than one neutral chip.
const ROLE_TONES: Record<Role, BadgeTone> = {
  Admin: "danger",
  Teacher: "info",
  Student: "neutral",
};

export default function AdminUsersPage() {
  // null until AppShell's /auth/me lands. Only used to mark the admin's own row, so a null frame just
  // means no row is marked yet.
  const currentUser = useSession();

  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | "">("");

  // Two pieces of state for one input. `search` is what the box shows; `appliedSearch` is what the
  // loader depends on. Without the split, every keystroke would change the loader's identity and fire a
  // request — so the search only travels to the server when the form is submitted.
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) =>
      listUsers(
        {
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          role: role || undefined,
          search: appliedSearch || undefined,
          sortBy: "fullName",
          sortDir: "asc",
        },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [page, role, appliedSearch, reloadKey],
  );

  const { data, error, loading } = useAsync(loader);

  const handleDelete = async (user: AdminUser) => {
    if (
      !window.confirm(
        `Delete ${user.fullName} (${user.email})? This cannot be undone.\n\n` +
          "Users who have created assignments or submitted work cannot be deleted.",
      )
    ) {
      return;
    }

    setBusyId(user.id);
    setActionError(null);

    try {
      await deleteUser(user.id);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      // A 409 here is one of two deliberate refusals — academic records on file, or an admin deleting
      // themselves — and the server's sentence says which, so it is shown as-is.
      setActionError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create the accounts for teachers and students, and reset passwords."
        action={
          <Link href="/admin/users/new">
            <Button>New user</Button>
          </Link>
        }
      />

      <form
        // A form, not an onChange handler: search runs on submit so typing a name costs one request
        // instead of one per letter.
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
          setPage(1);
        }}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="w-56">
          <Select
            label="Filter by role"
            value={role}
            options={[
              { value: "", label: "All roles" },
              { value: "Student", label: "Student" },
              { value: "Teacher", label: "Teacher" },
              { value: "Admin", label: "Admin" },
            ]}
            onChange={(event) => {
              setRole(event.target.value as Role | "");
              setPage(1);
            }}
          />
        </div>

        <div className="w-64">
          <Input
            label="Search"
            type="search"
            value={search}
            placeholder="Name or email"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Button type="submit" variant="secondary">
          Search
        </Button>

        {(appliedSearch || role) && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
              setRole("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {error && <Alert className="mb-4">{error}</Alert>}
      {actionError && <Alert className="mb-4">{actionError}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="No users match"
          description={
            appliedSearch || role
              ? "Try a different search term, or clear the filters."
              : "Create the first teacher or student account."
          }
          action={
            <Link href="/admin/users/new">
              <Button>New user</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Created</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((user) => {
                  // The API refuses self-deletion with a 409. Disabling the button says so before the
                  // round trip rather than after it.
                  const isSelf = user.id === currentUser?.id;

                  return (
                    <TR key={user.id}>
                      <TD className="font-medium text-slate-900">
                        {user.fullName}
                        {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                      </TD>

                      <TD className="text-slate-600">{user.email}</TD>

                      <TD>
                        <Badge tone={ROLE_TONES[user.role]}>{user.role}</Badge>
                      </TD>

                      <TD className="whitespace-nowrap">{formatDate(user.createdAt)}</TD>

                      <TD align="right">
                        <div className="flex justify-end gap-1.5 whitespace-nowrap">
                          <Link href={`/admin/users/${user.id}/edit`}>
                            <Button size="sm" variant="secondary">
                              Edit
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isSelf}
                            title={isSelf ? "You cannot delete your own account." : undefined}
                            loading={busyId === user.id}
                            onClick={() => void handleDelete(user)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            )}
          </TableWrap>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
