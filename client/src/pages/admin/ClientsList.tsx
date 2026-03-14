import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  usersQuery,
  phasesQuery,
  useCreateUser,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  UserPlus,
  ChevronRight,
  Activity,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminClientsList() {
  const [search, setSearch] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [creatingRole, setCreatingRole] = useState<"Client" | "Admin">("Client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const { toast } = useToast();
  const { sessionUser } = useAuth();
  const createUser = useCreateUser();
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery(usersQuery);
  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);

  const clients = allUsers.filter((u: any) => {
    if (u.role !== "Client") return false;
    if (u.status === "Removed") return false;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
  const activeClients = clients.filter((client: any) => client.status === "Active");
  const inactiveClients = clients.filter((client: any) => client.status !== "Active");

  const getClientStatus = (client: any) => {
    if (client.status !== "Active") {
      const archivedCount = allPhases.filter((phase: any) => phase.clientId === client.id).length;
      return {
        label: "Inactive",
        type: "secondary",
        desc: archivedCount > 0 ? `${archivedCount} archived phase${archivedCount > 1 ? "s" : ""}` : "No archived phases",
      };
    }
    const clientPhases = allPhases.filter((p: any) => p.clientId === client.id);
    const activePhase = clientPhases.find((p: any) => p.status === 'Active');
    const pendingPhase = clientPhases.find((p: any) => p.status === 'Waiting for Movement Check');

    if (pendingPhase) return { label: 'Action Required', type: 'destructive', desc: 'Movement Check Pending' };
    if (activePhase) return { label: 'Active', type: 'default', desc: activePhase.name };
    return { label: 'No Active Phase', type: 'secondary', desc: 'Needs programming' };
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setAvatar("");
    setCreatingRole("Client");
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionUser || sessionUser.role !== "Admin") {
      toast({
        title: "Unauthorized",
        description: "Only admins can create new accounts.",
        variant: "destructive",
      });
      return;
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedAvatar = avatar.trim();

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      toast({
        title: "Missing required fields",
        description: "Name, email, and password are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createUser.mutateAsync({
        name: normalizedName,
        email: normalizedEmail,
        password: normalizedPassword,
        role: creatingRole,
        avatar: normalizedAvatar ? normalizedAvatar : null,
      });

      toast({
        title: creatingRole === "Admin" ? "Coach account created" : "Client account created",
        description: `${normalizedName} can now sign in with ${normalizedEmail}.`,
      });
      setIsAddUserOpen(false);
      resetForm();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message.includes(": ")
            ? error.message.split(": ").slice(-1)[0]
            : error.message
          : "Unexpected error while creating the account.";
      toast({
        title: "Failed to create account",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (loadingUsers || loadingPhases) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-clients-title">Client Management</h1>
          <p className="text-slate-500 mt-1">Manage active and inactive clients. Open a client to change account access.</p>
        </div>
        <Button 
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6" 
          data-testid="button-add-client"
          onClick={() => setIsAddUserOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Dialog
        open={isAddUserOpen}
        onOpenChange={(open) => {
          setIsAddUserOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new client or coach account.</DialogDescription>
          </DialogHeader>

          <Tabs
            value={creatingRole}
            onValueChange={(value) => setCreatingRole(value as "Client" | "Admin")}
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="Client">Add Client</TabsTrigger>
              <TabsTrigger value="Admin">Add Coach</TabsTrigger>
            </TabsList>

            <TabsContent value={creatingRole}>
              <form className="space-y-4 mt-4" onSubmit={handleCreateUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-name">Full Name</Label>
                    <Input
                      id="new-user-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={creatingRole === "Admin" ? "Coach Name" : "Client Name"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-email">Email</Label>
                    <Input
                      id="new-user-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Temporary Password</Label>
                    <Input
                      id="new-user-password"
                      type="password"
                      minLength={8}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-avatar">Avatar URL (optional)</Label>
                    <Input
                      id="new-user-avatar"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUser.isPending}>
                    {createUser.isPending
                      ? "Creating..."
                      : creatingRole === "Admin"
                        ? "Create Coach"
                        : "Create Client"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm max-w-md">
        <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
        <Input 
          type="search" 
          placeholder="Search clients..." 
          className="border-none shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent text-slate-900"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-clients"
        />
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Active Clients</h2>
            <Badge className="bg-green-100 text-green-700 border-none">{activeClients.length}</Badge>
          </div>
          {activeClients.length === 0 ? (
            <Card className="border-slate-200 rounded-2xl bg-white">
              <CardContent className="p-6 text-sm text-slate-500">No active clients match your search.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeClients.map((client: any) => {
                const status = getClientStatus(client);
                return (
                  <Card key={client.id} className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl" data-testid={`card-client-${client.id}`}>
                    <Link href={`/app/admin/clients/${client.id}`} className="block hover:bg-slate-50 transition-colors group">
                      <CardContent className="p-0">
                        <div className="p-6 flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border border-slate-100 shadow-sm">
                              <AvatarImage src={client.avatar} />
                              <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold">{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors" data-testid={`text-client-name-${client.id}`}>{client.name}</h3>
                              <p className="text-sm text-slate-500">{client.email}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {status.type === "destructive" ? <AlertCircle className="h-4 w-4 text-rose-500" /> : <Activity className="h-4 w-4 text-slate-400" />}
                            <span className="text-sm font-medium text-slate-700">{status.desc}</span>
                          </div>
                          <Badge variant={status.type as any} className={status.type === "destructive" ? "bg-rose-100 text-rose-700 hover:bg-rose-200 border-none" : status.type === "default" ? "bg-green-100 text-green-700 hover:bg-green-200 border-none" : "bg-slate-200 text-slate-700 border-none"}>
                            {status.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Inactive Clients</h2>
            <Badge className="bg-slate-200 text-slate-700 border-none">{inactiveClients.length}</Badge>
          </div>
          {inactiveClients.length === 0 ? (
            <Card className="border-slate-200 rounded-2xl bg-white">
              <CardContent className="p-6 text-sm text-slate-500">No inactive clients.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inactiveClients.map((client: any) => {
                const status = getClientStatus(client);
                return (
                  <Card key={client.id} className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl" data-testid={`card-client-inactive-${client.id}`}>
                    <Link href={`/app/admin/clients/${client.id}`} className="block hover:bg-slate-50 transition-colors group">
                      <CardContent className="p-0">
                        <div className="p-6 flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border border-slate-100 shadow-sm">
                              <AvatarImage src={client.avatar} />
                              <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold">{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{client.name}</h3>
                              <p className="text-sm text-slate-500">{client.email}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">{status.desc}</span>
                          </div>
                          <Badge className="bg-slate-200 text-slate-700 border-none">{status.label}</Badge>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
