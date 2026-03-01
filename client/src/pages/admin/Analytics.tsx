import { useQuery } from "@tanstack/react-query";
import { usersQuery, phasesQuery, sessionsQuery } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Activity, CheckCircle2, Loader2 } from "lucide-react";

export default function AdminAnalytics() {
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery(usersQuery);
  const { data: allPhases = [] } = useQuery(phasesQuery);
  const { data: allSessions = [] } = useQuery(sessionsQuery);

  const clients = allUsers.filter((u: any) => u.role === 'Client');
  const activeClients = clients.filter((c: any) => 
    allPhases.some((p: any) => p.clientId === c.id && (p.status === 'Active' || p.status === 'Waiting for Movement Check'))
  );

  const totalCompleted = allSessions.reduce((acc: number, s: any) => 
    acc + ((s.completedInstances as any[])?.length || 0), 0
  );

  if (loadingUsers) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-analytics-title">Analytics</h1>
        <p className="text-slate-500 mt-1">High-level view of roster engagement and performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Clients</CardTitle>
            <Activity className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-active-clients">{activeClients.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Clients</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-total-clients">{clients.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Sessions Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-sessions-completed">{totalCompleted}</div>
            <p className="text-xs text-slate-500 mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Client Adherence Board</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-100">
               {clients.map((client: any) => {
                 const clientPhase = allPhases.find((p: any) => p.clientId === client.id && (p.status === 'Active' || p.status === 'Waiting for Movement Check'));
                 return (
                   <div key={client.id} className="p-4 flex items-center justify-between" data-testid={`row-adherence-${client.id}`}>
                     <div>
                       <div className="font-semibold text-slate-900">{client.name}</div>
                       <div className="text-sm text-slate-500">{clientPhase?.name || 'No active phase'}</div>
                     </div>
                     <div className="text-right">
                        <div className={`font-bold ${clientPhase?.status === 'Active' ? 'text-green-600' : 'text-amber-500'}`}>
                          {clientPhase?.status === 'Active' ? 'Active' : clientPhase ? 'Pending' : 'Inactive'}
                        </div>
                     </div>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <TrendingUp className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Progression Charts</h3>
            <p className="max-w-sm mt-1">Track estimated 1RM and volume load over time once more data is collected.</p>
        </Card>
      </div>
    </div>
  );
}
