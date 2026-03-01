import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, ShieldCheck, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usersQuery } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { data: allUsers = [], isLoading } = useQuery(usersQuery);

  const handleLogin = (user: any) => {
    login(user);
    if (user.role === 'Admin') {
      setLocation("/app/admin/clients");
    } else {
      setLocation("/app/client/my-phase");
    }
  };

  const adminUser = allUsers.find((u: any) => u.role === 'Admin');
  const clientUsers = allUsers.filter((u: any) => u.role === 'Client');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-200">
            <Dumbbell className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight" data-testid="text-login-title">
            Welcome to Nexus
          </h2>
          <p className="mt-2 text-slate-500">
            Select a demo account to sign in and explore the app.
          </p>
        </div>
        
        <div className="space-y-6 mt-10">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Admin View</h3>
            {adminUser && (
              <Card 
                className="cursor-pointer border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all group bg-white overflow-hidden"
                onClick={() => handleLogin(adminUser)}
                data-testid={`card-login-${adminUser.id}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-12 w-12 border border-slate-100">
                    <AvatarImage src={adminUser.avatar} />
                    <AvatarFallback className="bg-slate-100 text-slate-600"><ShieldCheck className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors" data-testid={`text-name-${adminUser.id}`}>{adminUser.name}</h4>
                    <p className="text-sm text-slate-500">{adminUser.email}</p>
                  </div>
                  <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 bg-indigo-50 rounded-full" data-testid={`button-login-${adminUser.id}`}>
                    Log in
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Client View</h3>
            <div className="space-y-3">
              {clientUsers.map((client: any) => (
                <Card 
                  key={client.id}
                  className="cursor-pointer border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all group bg-white overflow-hidden"
                  onClick={() => handleLogin(client)}
                  data-testid={`card-login-${client.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-slate-100">
                      <AvatarImage src={client.avatar} />
                      <AvatarFallback className="bg-slate-100 text-slate-600"><User className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors" data-testid={`text-name-${client.id}`}>{client.name}</h4>
                      <p className="text-sm text-slate-500">{client.email}</p>
                    </div>
                    <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 bg-indigo-50 rounded-full" data-testid={`button-login-${client.id}`}>
                      Log in
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
