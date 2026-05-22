'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, FileText, MessageSquare,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  CreditCard, Bot, Activity, Shield, Menu, X,
  ClipboardList, Scan, Heart, UserCheck,
} from 'lucide-react';
import { tokenStore } from '@/lib/api';
import { authService } from '@/lib/auth';
import { getDashboardRoute, getRoleLabel, getRoleColor } from '@/lib/routing';
import { useUnreadCount } from '@/hooks/useApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = tokenStore.getRole() || 'patient';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: unreadData } = useUnreadCount();
  const unread = unreadData?.unread_count || 0;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.replace('/auth/login');
    }
  }, [router]);

  const handleLogout = async () => {
    await authService.logout();
    toast.success('Signed out successfully');
    router.replace('/');
  };

  const isAdmin = role === 'admin';
  const isPatient = role === 'patient';

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: getDashboardRoute(role), icon: LayoutDashboard },
    // Professional routes
    ...(!isPatient && !isAdmin ? [
      { label: 'My Patients', href: '/dashboard/professional/patients', icon: Users },
      { label: 'Appointments', href: '/dashboard/professional/appointments', icon: Calendar },
      { label: 'Sessions', href: '/dashboard/professional/sessions', icon: Activity },
      { label: 'Clinical Notes', href: '/dashboard/professional/notes', icon: ClipboardList },
      { label: 'Care Plans', href: '/dashboard/professional/care-plans', icon: Heart },
      { label: '3D Editor', href: '/editor', icon: Scan },
      { label: 'TheraPay', href: '/dashboard/professional/therapay', icon: CreditCard },
    ] : []),
    // Patient routes
    ...(isPatient ? [
      { label: 'My Professionals', href: '/dashboard/patient/professionals', icon: UserCheck },
      { label: 'Appointments', href: '/dashboard/patient/appointments', icon: Calendar },
      { label: 'Sessions', href: '/dashboard/patient/sessions', icon: Activity },
      { label: 'Care Plans', href: '/dashboard/patient/care-plans', icon: Heart },
      { label: 'Payments', href: '/dashboard/patient/payments', icon: CreditCard },
    ] : []),
    // Admin routes
    ...(isAdmin ? [
      { label: 'Users', href: '/dashboard/admin/users', icon: Users },
      { label: 'Professionals', href: '/dashboard/admin/professionals', icon: UserCheck },
      { label: 'Patients', href: '/dashboard/admin/patients', icon: Users },
      { label: 'Analytics', href: '/dashboard/admin/analytics', icon: Activity },
      { label: 'Audit Logs', href: '/dashboard/admin/audit', icon: Shield },
    ] : []),
    // Shared
    { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
    { label: 'AI Assistant', href: '/dashboard/ai', icon: Bot },
    { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unread },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const Sidebar = () => (
    <div className={cn(
      'flex flex-col h-full bg-slate-900 text-white transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {!collapsed && (
          <Link href={getDashboardRoute(role)} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg dynax-gradient flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-sm">DX</span>
            </div>
            <span className="font-display font-bold text-lg">DynaX</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg dynax-gradient flex items-center justify-center mx-auto">
            <span className="text-white font-display font-bold text-sm">DX</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('text-slate-400 hover:text-white transition-colors', collapsed && 'mx-auto mt-2')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-800">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', getRoleColor(role))}>
            {getRoleLabel(role)}
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {item.badge && item.badge > 0 && (
                <span className={cn(
                  'ml-auto bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold',
                  collapsed ? 'absolute -top-1 -right-1 w-4 h-4 text-[10px]' : 'w-5 h-5'
                )}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 flex-shrink-0">
            <Sidebar />
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-100">
          <button onClick={() => setMobileOpen(true)} className="text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-7 h-7 rounded-lg dynax-gradient flex items-center justify-center">
            <span className="text-white font-bold text-xs">DX</span>
          </div>
          <span className="font-display font-bold text-slate-900">DynaX</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
