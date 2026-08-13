"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAdminUsers } from "@/lib/api/admin";

export function MemberJump() {
  const [input, setInput] = React.useState("");
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const results = useQuery({
    queryKey: ["admin", "users", "jump", q],
    queryFn: () => getAdminUsers({ q, page: 1 }),
    enabled: q.length >= 2,
  });
  const users = results.data?.users.slice(0, 5) ?? [];
  return (
    <div className="relative w-full max-w-sm">
      <label className="sr-only" htmlFor="admin-member-jump">
        Find a member
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
      <Input
        id="admin-member-jump"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Find a member…"
        className="border-white/10 bg-bg-0/35 pl-9 backdrop-blur-md"
        autoComplete="off"
      />
      {q.length >= 2 ? (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-card border border-line bg-bg-1/90 shadow-e3 backdrop-blur-md">
          {results.isLoading ? (
            <p className="px-3 py-2 text-xs text-text-lo">Searching…</p>
          ) : users.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-lo">No members match that.</p>
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="block px-3 py-2 hover:bg-ice/10"
                    onClick={() => setInput("")}
                  >
                    <p className="truncate text-sm text-text-hi">
                      {user.publicProfile?.display_name ?? user.email}
                    </p>
                    <p className="truncate text-[11px] text-text-lo">{user.email}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
