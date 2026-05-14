import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, UserPlus, KeyRound, Ban, Trash2, ShieldCheck, ShieldOff, RotateCcw } from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  roles: string[];
};

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminUsers() {
  usePageMeta({
    title: "User Management — Col'Cacchio Dashboard",
    description: "Create, disable, and reset access for internal dashboard users.",
  });
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await callAdmin("list")) as { users: AdminUser[] },
    enabled: isAdmin === true,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  const createMut = useMutation({
    mutationFn: async () =>
      callAdmin("create", {
        email: newEmail,
        is_admin: newIsAdmin,
        redirect_to: `${window.location.origin}/reset-password`,
      }),
    onSuccess: () => {
      toast.success("User created and reset email sent");
      setCreateOpen(false);
      setNewEmail("");
      setNewIsAdmin(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (email: string) =>
      callAdmin("reset_password", {
        email,
        redirect_to: `${window.location.origin}/reset-password`,
      }),
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const banMut = useMutation({
    mutationFn: (user_id: string) => callAdmin("ban", { user_id }),
    onSuccess: () => { toast.success("User disabled"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unbanMut = useMutation({
    mutationFn: (user_id: string) => callAdmin("unban", { user_id }),
    onSuccess: () => { toast.success("User re-enabled"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => callAdmin("delete", { user_id }),
    onSuccess: () => { toast.success("User deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminMut = useMutation({
    mutationFn: ({ user_id, is_admin }: { user_id: string; is_admin: boolean }) =>
      callAdmin("set_admin", { user_id, is_admin }),
    onSuccess: () => { toast.success("Role updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isAdmin === null) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (isAdmin === false) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>You need admin privileges to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isBanned = (u: AdminUser) =>
    !!u.banned_until && new Date(u.banned_until) > new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Create, disable, or reset access for dashboard users.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RotateCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" /> New user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
                <DialogDescription>
                  The user is auto-confirmed and will receive a password reset email to set their own password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@colcacchio.co.za"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="new-admin"
                    checked={newIsAdmin}
                    onCheckedChange={(v) => setNewIsAdmin(!!v)}
                  />
                  <Label htmlFor="new-admin" className="font-normal cursor-pointer">
                    Grant admin role
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newEmail}
                >
                  {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create user
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{data?.users?.length ?? 0} accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          {data?.users && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => {
                    const banned = isBanned(u);
                    const admin = u.roles.includes("admin");
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                        <TableCell>
                          {banned ? (
                            <Badge variant="destructive">Disabled</Badge>
                          ) : u.email_confirmed_at ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {admin ? <Badge>Admin</Badge> : <span className="text-muted-foreground text-sm">User</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Send password reset"
                              onClick={() => u.email && resetMut.mutate(u.email)}
                              disabled={!u.email || resetMut.isPending}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title={admin ? "Remove admin" : "Make admin"}
                              onClick={() => adminMut.mutate({ user_id: u.id, is_admin: !admin })}
                              disabled={adminMut.isPending}
                            >
                              {admin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            </Button>
                            {banned ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Re-enable"
                                onClick={() => unbanMut.mutate(u.id)}
                                disabled={unbanMut.isPending}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" title="Disable">
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Disable {u.email}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      The user won't be able to sign in until you re-enable their account.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => banMut.mutate(u.id)}>
                                      Disable
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" title="Delete" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the account. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMut.mutate(u.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
