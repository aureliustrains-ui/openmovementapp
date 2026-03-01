import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { currentUser } from "@/lib/mock-data";
import { 
  Users, 
  Library, 
  BarChart, 
  Settings, 
  Dumbbell, 
  MessageCircle, 
  Info,
  LogOut
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
  { href: "/app/admin/clients", label: "Client Management", icon: Users },
  { href: "/app/admin/templates", label: "Templates", icon: Library },
  { href: "/app/admin/analytics", label: "Analytics", icon: BarChart },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const getClientNavItems = () => [
  { href: "/app/client/my-phase", label: "My Phase", icon: Dumbbell },
  { href: "/app/client/chat", label: "Chat with Coach", icon: MessageCircle },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/client/info", label: "Information", icon: Info },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const navItems = currentUser.role === 'Admin' ? getAdminNavItems() : getClientNavItems();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-col hidden md:flex border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-3 w-full">
             <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center text-white">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="font-display font-semibold text-white truncate tracking-tight">
              Nexus Training
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu</div>
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href) && (item.href !== '/app/settings' || location === '/app/settings');
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                  isActive 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "hover:bg-slate-800/50 hover:text-white text-slate-400"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-slate-800">
           <div className="flex items-center gap-3 px-2">
             <Avatar className="h-8 w-8 border border-slate-700">
               <AvatarImage src={currentUser.avatar} />
               <AvatarFallback className="bg-slate-800 text-slate-400">{currentUser.name.charAt(0)}</AvatarFallback>
             </Avatar>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
               <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar for mobile + user menu */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 md:justify-end shadow-sm">
           <div className="md:hidden flex items-center gap-2">
             <Dumbbell className="h-5 w-5 text-indigo-600" />
             <span className="font-display font-bold">Nexus</span>
           </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full border border-slate-200">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-slate-900">{currentUser.name}</p>
                    <p className="text-xs leading-none text-slate-500">
                      {currentUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/settings">Profile Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/login" className="text-red-600 flex items-center cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
