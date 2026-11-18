import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  coachesQuery,
  useAssignClientCoach,
  useConvertClientToCoach,
  useCreateCoach,
  useRemoveCoach,
  useUpdateCoach,
  usersQuery,
  type CoachRow,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message.includes(": ") ? error.message.split(": ").slice(-1)[0] : error.message;
  }
  return fallback;
}

export default function AdminCoaches() {
  const { toast } = useToast();
  const { data: coaches = [], isLoading } = useQuery(coachesQuery);
  const { data: allUsers = [] } = useQuery(usersQuery);
  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const removeCoach = useRemoveCoach();
  const convertClient = useConvertClientToCoach();
  const assignClient = useAssignClientCoach();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [convertId, setConvertId] = useState<string>("");

  const activeCoaches = coaches.filter((coach) => coach.status === "Active");
  const convertible = (allUsers as Array<{ id: string; name: string; email: string; role: string; status: string }>)
    .filter((user) => user.role === "Client" && user.status === "Active")
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitNewCoach = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createCoach.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      toast({ title: "Coach created", description: `${name.trim()} can now sign in.` });
      setAddOpen(false);
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      toast({
        title: "Could not create coach",
        description: errorMessage(error, "Unexpected error."),
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (coach: CoachRow) => {
    const next = generatePassword();
    try {
      await updateCoach.mutateAsync({ id: coach.id, password: next });
      try {
        await navigator.clipboard.writeText(next);
      } catch {
        // Clipboard is optional; the password is shown below either way.
      }
      toast({
        title: `New password for ${coach.name}`,
        description: `${next} (copied). Send it to them yourself.`,
      });
    } catch (error) {
      toast({ title: "Could not reset password", description: errorMessage(error, ""), variant: "destructive" });
    }
  };

  const setStatus = async (coach: CoachRow, status: "Active" | "Inactive") => {
    try {
      await updateCoach.mutateAsync({ id: coach.id, status });
    } catch (error) {
      toast({ title: "Could not update coach", description: errorMessage(error, ""), variant: "destructive" });
    }
  };

  const remove = async (coach: CoachRow) => {
    if (
      !window.confirm(
        `Remove ${coach.name}? They can no longer sign in. Their clients, plans, logs and emails stay saved and you can still open them.`,
      )
    ) {
      return;
    }
    try {
      await removeCoach.mutateAsync(coach.id);
      toast({ title: "Coach removed" });
    } catch (error) {
      toast({ title: "Could not remove coach", description: errorMessage(error, ""), variant: "destructive" });
    }
  };

  const convert = async () => {
    if (!convertId) return;
    try {
      await convertClient.mutateAsync(convertId);
      toast({ title: "Account is now a coach" });
      setConvertId("");
    } catch (error) {
      toast({
        title: "Could not convert this account",
        description: errorMessage(error, ""),
        variant: "destructive",
      });
    }
  };

  const moveClient = async (clientId: string, value: string) => {
    try {
      await assignClient.mutateAsync({ clientId, coachId: value === "__owner__" ? null : value });
    } catch (error) {
      toast({ title: "Could not move client", description: errorMessage(error, ""), variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Coaches</h1>
          <p className="text-sm text-slate-500">
            Each coach sees only their own clients. Everyone shares the exercise library.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add coach
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : coaches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No coaches yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {coaches.map((coach) => {
            const open = expanded.has(coach.id);
            const removed = coach.status === "Removed";
            return (
              <li
                key={coach.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                data-testid={`coach-${coach.id}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => toggle(coach.id)}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{coach.name}</div>
                      <div className="truncate text-xs text-slate-500">{coach.email}</div>
                    </div>
                  </button>
                  <Badge variant={coach.status === "Active" ? "default" : "secondary"}>
                    {coach.status === "Removed" ? "Removed" : coach.status}
                  </Badge>
                  <div className="text-xs text-slate-500">
                    {coach.clientCount} client{coach.clientCount === 1 ? "" : "s"} ·{" "}
                    {coach.exercisesAdded} exercise{coach.exercisesAdded === 1 ? "" : "s"} added
                  </div>
                  {!removed ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void resetPassword(coach)}>
                        New password
                      </Button>
                      {coach.status === "Active" ? (
                        <Button size="sm" variant="outline" onClick={() => void setStatus(coach, "Inactive")}>
                          Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void setStatus(coach, "Active")}>
                          Activate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => void remove(coach)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>

                {open ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {coach.clients.length === 0 ? (
                      <p className="text-sm text-slate-500">No clients.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {coach.clients.map((client) => (
                          <li key={client.id} className="flex items-center gap-3 py-2 text-sm">
                            <Link
                              href={`/app/admin/clients/${client.id}`}
                              className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline"
                            >
                              {client.name}
                            </Link>
                            <span className="truncate text-xs text-slate-500">
                              {client.activePhaseName ?? "No active phase"}
                            </span>
                            <Select
                              value={coach.id}
                              onValueChange={(value) => void moveClient(client.id, value)}
                            >
                              <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__owner__">Move to me</SelectItem>
                                {activeCoaches.map((target) => (
                                  <SelectItem key={target.id} value={target.id}>
                                    {target.name}
                                  </SelectItem>
                                ))}
                                {!activeCoaches.some((target) => target.id === coach.id) ? (
                                  <SelectItem value={coach.id}>{coach.name}</SelectItem>
                                ) : null}
                              </SelectContent>
                            </Select>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      Opening a client shows their plan and logs. Please change things only with the
                      coach's knowledge.
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Turn an existing account into a coach</h2>
        <p className="text-xs text-slate-500">
          For someone who signed up as a client. Only works while the account has no training plans.
        </p>
        <div className="flex gap-2">
          <Select value={convertId} onValueChange={setConvertId}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {convertible.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!convertId || convertClient.isPending} onClick={() => void convert()}>
            Make coach
          </Button>
        </div>
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add coach</DialogTitle>
            <DialogDescription>
              They sign in with this email and password. You send them the password yourself.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitNewCoach}>
            <div className="space-y-2">
              <Label htmlFor="coach-name">Full name</Label>
              <Input id="coach-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-email">Email</Label>
              <Input
                id="coach-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="coach-password"
                  type="text"
                  minLength={8}
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                  Generate
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCoach.isPending}>
                Create coach
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
