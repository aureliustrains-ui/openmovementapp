import { ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { chatUnreadQuery } from "@/lib/api";
import { 
  Users, 
  Library, 
  Settings, 
  Dumbbell, 
  MessageCircle, 
  Info,
  LogOut,
  Repeat
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
import { BrandLogo } from "@/components/brand/BrandLogo";

const getAdminNavItems = () => [
  { href: "/app/admin/clients", label: "Clients", icon: Users },
  { href: "/app/admin/templates", label: "Templates", icon: Library },
];

const getClientPrimaryNavItems = () => [
  { href: "/app/client/my-phase", label: "Phases", icon: Dumbbell },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, sessionUser, logout, impersonating, stopImpersonating } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  const { data: unreadData } = useQuery({
    ...chatUnreadQuery(sessionUser?.id || "", sessionUser?.role || "Client"),
    enabled: !!sessionUser,
  });

  if (!user || !sessionUser) return null;

  const navItems = sessionUser.role === 'Admin' ? getAdminNavItems() : getClientPrimaryNavItems();
  const totalUnread = unreadData?.total || 0;
  const menuDisplayName = useMemo(() => {
    if (sessionUser.role !== "Admin") {
      return user.name || user.email;
    }

    const firstNameCandidate = ((user as { firstName?: string | null }).firstName || (user as { infos?: string | null }).infos || "").trim();
    const nameCandidate = (user.name || "").trim();

    if (firstNameCandidate && nameCandidate) {
      const startsWithFirstName = nameCandidate.toLowerCase().startsWith(`${firstNameCandidate.toLowerCase()} `);
      return startsWithFirstName ? nameCandidate : `${firstNameCandidate} ${nameCandidate}`;
    }
    return firstNameCandidate || nameCandidate || user.email;
  }, [sessionUser.role, user]);

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    logout();
    setLocation("/login");
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    setLocation("/app/admin/clients");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-8">
          <Link href={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/my-phase"} className="flex items-center gap-2.5 shrink-0">
            <BrandLogo textClassName="text-sm sm:text-base" />
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href) && (item.href !== '/app/settings' || location === '/app/settings');
              const isAdminNav = sessionUser.role === "Admin";
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                    isAdminNav ? "gap-0 px-2 py-2 sm:gap-2 sm:px-3" : "gap-2 px-3 py-2"
                  } ${
                    isActive 
                      ? "border-b-2 border-[#2B4A42] text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className={isAdminNav ? "hidden sm:inline" : ""}>{item.label}</span>
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
          
          <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`relative h-9 w-9 rounded-full border bg-white transition-colors ${
                  profileMenuOpen
                    ? "border-[#2B4A42]/60 ring-2 ring-[#2B4A42]/25"
                    : "border-slate-200"
                }`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatar || undefined} alt={user.name || undefined} />
                  <AvatarFallback className="bg-slate-100 text-slate-900 font-semibold">{user.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-slate-900">{menuDisplayName}</p>
                  <p className="text-xs leading-none text-slate-500">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sessionUser.role === "Client" ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/app/client/chat" className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>Chat</span>
                      {totalUnread > 0 ? (
                        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1" data-testid="badge-chat-unread-menu">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/app/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/app/client/info" className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      <span>Guide</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href="/app/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              
              {impersonating && (
                <DropdownMenuItem onClick={handleStopImpersonating} className="text-[#2B4A42] font-medium cursor-pointer">
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

      <main className="flex-1 overflow-auto bg-white">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
