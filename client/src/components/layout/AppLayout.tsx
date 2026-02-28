import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { currentWorkspace, currentUser } from "@/lib/mock-data";
import { 
  LayoutDashboard, 
  CheckSquare, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  Folder, 
  Settings, 
  ShieldCheck,
  Bell,
  Search,
  LogOut,
  Dumbbell
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const getNavItems = (role: string) => {
  const items = [
    { href: "/app/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/app/projects", label: "Projects", icon: CheckSquare },
    { href: "/app/messages", label: "Messages", icon: MessageSquare },
    { href: "/app/calendar", label: "Calendar", icon: CalendarIcon },
    { href: "/app/files", label: "Files", icon: Folder },
  ];
  if (role === 'Client' || role === 'Admin') {
    // Visible to Admin too for testing purposes
    items.push({ href: "/app/my-training", label: "My Training Plan", icon: Dumbbell });
  }
  return items;
};

const getBottomNavItems = (role: string) => {
  const items = [];
  if (role === 'Admin') {
    items.push({ href: "/app/admin/training", label: "Training Plans", icon: Dumbbell });
    items.push({ href: "/app/admin", label: "Admin Panel", icon: ShieldCheck });
  }
  items.push({ href: "/app/settings", label: "Settings", icon: Settings });
  return items;
};

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const navItems = getNavItems(currentUser.role);
  const bottomNavItems = getBottomNavItems(currentUser.role);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-3 w-full">
            <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold">
              N
            </div>
            <span className="font-display font-semibold text-white truncate">
              {currentWorkspace.name}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</div>
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                location === item.href 
                  ? "bg-slate-800 text-white" 
                  : "hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}

          <div className="mt-8 mb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Workspace</div>
          </div>
          
          {bottomNavItems.map((item) => {
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  location === item.href 
                    ? "bg-slate-800 text-white" 
                    : "hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search everywhere..." 
                className="w-full pl-9 bg-slate-50 border-none focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-500 rounded-full">
              <Bell className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/settings">Profile Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help">Help & Support</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/login" className="text-red-600 flex items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
