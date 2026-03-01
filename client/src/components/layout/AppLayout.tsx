import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  Users, 
  Library, 
  BarChart, 
  Settings, 
  Dumbbell, 
  MessageCircle, 
  Info,
  LogOut,
  Repeat,
  ClipboardCheck
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const getAdminNavItems = () => [
  { href: "/app/admin/clients", label: "Clients", icon: Users },
  { href: "/app/admin/templates", label: "Templates", icon: Library },
  { href: "/app/admin/analytics", label: "Analytics", icon: BarChart },
  { href: "/app/admin/qa", label: "QA", icon: ClipboardCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const getClientNavItems = () => [
  { href: "/app/client/my-phase", label: "My Phases", icon: Dumbbell },
  { href: "/app/client/chat", label: "Chat", icon: MessageCircle },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/client/info", label: "Info", icon: Info },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, impersonating, stopImpersonating } = useAuth();
  
  if (!user) return null;

  const navItems = user.role === 'Admin' ? getAdminNavItems() : getClientNavItems();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    setLocation("/app/admin/clients");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-8">
          <Link href={user.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="font-display font-bold text-slate-900 tracking-tight hidden sm:inline">Nexus</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href) && (item.href !== '/app/settings' || location === '/app/settings');
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {impersonating && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleStopImpersonating}
            >
              <Repeat className="mr-2 h-4 w-4" /> Exit Impersonation
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-slate-200">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatar || undefined} alt={user.name || undefined} />
                  <AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold">{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-slate-900">{user.name}</p>
                  <p className="text-xs leading-none text-slate-500">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/settings">Profile Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              
              {impersonating && (
                <DropdownMenuItem onClick={handleStopImpersonating} className="text-indigo-600 font-medium cursor-pointer">
                  <Repeat className="mr-2 h-4 w-4" />
                  <span>Exit Impersonation</span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 flex items-center cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
