import { useLocation, Link } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  Trophy,
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  ClipboardList,
  UserCheck,
  Home,
} from 'lucide-react';

const adminMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Programs', url: '/programs', icon: ClipboardList },
  { title: 'Teams', url: '/teams', icon: Users },
  { title: 'Roster', url: '/roster', icon: UserCheck },
  { title: 'Schedule', url: '/schedule', icon: Calendar },
  { title: 'Payments', url: '/payments', icon: CreditCard },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const coachMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'My Sessions', url: '/sessions', icon: Calendar },
  { title: 'Attendance', url: '/attendance', icon: UserCheck },
];

const parentMenuItems = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'My Athletes', url: '/athletes', icon: Users },
  { title: 'Schedule', url: '/schedule', icon: Calendar },
  { title: 'Payments', url: '/payments', icon: CreditCard },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, club, logout } = useAuth();

  const menuItems = user?.role === 'admin'
    ? adminMenuItems
    : user?.role === 'coach'
    ? coachMenuItems
    : parentMenuItems;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <div className="font-semibold text-sm">VisioSport</div>
            <div className="text-xs text-muted-foreground">{club?.name || 'Sports Club'}</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {user ? getInitials(user.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
