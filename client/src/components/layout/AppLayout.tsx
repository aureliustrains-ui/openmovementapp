import { ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { resolveUserFirstName } from "@/lib/userDisplayName";
import {
  adminClientsNotificationSummaryQuery,
  myNotificationSummaryQuery,
} from "@/lib/api";
import { 
  Users, 
  Library, 
  Settings, 
  Dumbbell, 
  House,
  MessageCircle,
  TrendingUp,
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

const getAdminNavItems = (attentionClientsCount: number) => [
  { href: "/app/admin/clients", label: "Clients", icon: Users, badgeCount: attentionClientsCount },
  { href: "/app/admin/templates", label: "Templates", icon: Library },
];

const getClientPrimaryNavItems = (input: {
  unreadChatCount: number;
  phaseAttentionCount: number;
}) => [
  { href: "/app/client/home", label: "Home", icon: House },
  {
    href: "/app/client/my-phase",
    label: "Current Phase",
    icon: Dumbbell,
    badgeCount: input.phaseAttentionCount,
  },
  {
    href: "/app/client/chat",
    label: "Chat",
    icon: MessageCircle,
    badgeCount: input.unreadChatCount,
  },
  { href: "/app/client/readiness", label: "Readiness", icon: TrendingUp },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, sessionUser, logout, impersonating, stopImpersonating } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  if (!user || !sessionUser) return null;

  const { data: adminNotificationSummary } = useQuery({
    ...adminClientsNotificationSummaryQuery,
    enabled: sessionUser.role === "Admin",
  });
  const { data: clientNotificationSummary } = useQuery({
    ...myNotificationSummaryQuery,
    enabled: sessionUser.role === "Client" && !impersonating,
  });

  const attentionClientsCount =
    sessionUser.role === "Admin"
      ? ((adminNotificationSummary as { clients?: Array<{ hasAttention?: boolean }> } | undefined)
          ?.clients || []
        ).filter((summary) => Boolean(summary?.hasAttention)).length
      : 0;
  const clientSummary = (clientNotificationSummary as
    | {
        unreadChatCount?: number;
        movementActionCount?: number;
        progressActionCount?: number;
        weeklyCheckinDue?: boolean;
      }
    | undefined) || {
    unreadChatCount: 0,
    movementActionCount: 0,
    progressActionCount: 0,
    weeklyCheckinDue: false,
  };
  const clientUnreadChatCount =
    sessionUser.role === "Client" ? clientSummary.unreadChatCount || 0 : 0;
  const clientPhaseAttentionCount =
    sessionUser.role === "Client"
      ? (clientSummary.movementActionCount || 0) +
        (clientSummary.progressActionCount || 0) +
        (clientSummary.weeklyCheckinDue ? 1 : 0)
      : 0;

  const navItems =
    sessionUser.role === "Admin"
      ? getAdminNavItems(attentionClientsCount)
      : getClientPrimaryNavItems({
          unreadChatCount: clientUnreadChatCount,
          phaseAttentionCount: clientPhaseAttentionCount,
        });
  const menuDisplayName = useMemo(() => {
    if (sessionUser.role !== "Admin") {
      return user.name || user.email;
    }

    const firstNameCandidate = resolveUserFirstName(user);
    const nameCandidate = (user.name || "").trim();

    if (firstNameCandidate && nameCandidate) {
      const firstLower = firstNameCandidate.toLowerCase();
      const nameLower = nameCandidate.toLowerCase();
      if (nameLower === firstLower || nameLower.startsWith(`${firstLower} `)) {
        return nameCandidate;
      }
      return `${firstNameCandidate} ${nameCandidate}`;
    }
    if (firstNameCandidate && firstNameCandidate !== "there") return firstNameCandidate;
    return nameCandidate || user.email;
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

  const contentContainerClass =
    sessionUser.role === "Admin"
      ? "w-full max-w-[1680px] mx-auto p-6 md:p-8"
      : "w-full max-w-7xl mx-auto p-6 md:p-8";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-8">
          <Link href={sessionUser.role === 'Admin' ? "/app/admin/clients" : "/app/client/home"} className="flex items-center gap-2.5 shrink-0">
            <BrandLogo textClassName="text-sm sm:text-base" />
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.href) && (item.href !== '/app/settings' || location === '/app/settings');
              const isAdminNav = sessionUser.role === "Admin";
              const isClientNav = sessionUser.role === "Client";
              const spacingClassName = isAdminNav
                ? "gap-0 px-2 py-2 sm:gap-2 sm:px-3"
                : isClientNav
                  ? "gap-2 px-2.5 py-2 sm:px-3"
                  : "gap-2 px-3 py-2";
              const labelClassName = isAdminNav
                ? "hidden sm:inline"
                : isClientNav
                  ? "hidden sm:inline"
                  : "";
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                    spacingClassName
                  } ${
                    isActive 
                      ? "border-b-2 border-slate-900 text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className={labelClassName}>{item.label}</span>
                  {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                      {item.badgeCount > 9 ? "9+" : item.badgeCount}
                    </span>
                  ) : null}
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
                    ? "border-slate-400 ring-2 ring-slate-200"
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
                <DropdownMenuItem onClick={handleStopImpersonating} className="text-slate-700 font-medium cursor-pointer">
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
        <div className={contentContainerClass}>
          {children}
        </div>
      </main>
    </div>
  );
}
