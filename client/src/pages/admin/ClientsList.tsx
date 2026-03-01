import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, ChevronRight, Activity, AlertCircle, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ComingSoonDialog } from "@/components/ComingSoonDialog";

export default function AdminClientsList() {
  const [search, setSearch] = useState("");
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery(usersQuery);
  const { data: allPhases = [], isLoading: loadingPhases } = useQuery(phasesQuery);

  const clients = allUsers.filter((u: any) => u.role === 'Client' && u.name.toLowerCase().includes(search.toLowerCase()));

  const getClientStatus = (clientId: string) => {
    const clientPhases = allPhases.filter((p: any) => p.clientId === clientId);
    const activePhase = clientPhases.find((p: any) => p.status === 'Active');
    const pendingPhase = clientPhases.find((p: any) => p.status === 'Waiting for Movement Check');

    if (pendingPhase) return { label: 'Action Required', type: 'destructive', desc: 'Movement Check Pending' };
    if (activePhase) return { label: 'Active', type: 'default', desc: activePhase.name };
    return { label: 'No Active Phase', type: 'secondary', desc: 'Needs programming' };
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
          <p className="text-slate-500 mt-1">Overview of all active roster clients.</p>
        </div>
        <Button 
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6" 
          data-testid="button-add-client"
          onClick={() => setIsComingSoonOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>

      <ComingSoonDialog 
        open={isComingSoonOpen} 
        onOpenChange={setIsComingSoonOpen} 
        title="Add Client Coming Soon"
        description="The ability to invite and add new clients to your roster is coming in the next update."
      />

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client: any) => {
          const status = getClientStatus(client.id);
          return (
            <Link key={client.id} href={`/app/admin/clients/${client.id}`}>
              <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group bg-white overflow-hidden rounded-2xl" data-testid={`card-client-${client.id}`}>
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
                      {status.type === 'destructive' ? <AlertCircle className="h-4 w-4 text-rose-500" /> : <Activity className="h-4 w-4 text-slate-400" />}
                      <span className="text-sm font-medium text-slate-700">{status.desc}</span>
                    </div>
                    <Badge variant={status.type as any} className={status.type === 'destructive' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-none' : status.type === 'default' ? 'bg-green-100 text-green-700 hover:bg-green-200 border-none' : 'bg-slate-200 text-slate-700 border-none'}>
                      {status.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
