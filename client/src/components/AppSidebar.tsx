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
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  ClipboardList,
  UserCheck,
  Home,
  FileText,
  DollarSign,
  CalendarDays,
  Link2,
  Shield,
  MessageSquare,
  Megaphone,
  Building2,
  TrendingUp,
} from 'lucide-react';
import visioSquadLogo from '@assets/ChatGPT_Image_Jan_29,_2026,_09_28_16_PM_1769747467171.png';

const adminMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Bulletin', url: '/bulletin', icon: Megaphone },
  { title: 'Programs', url: '/programs', icon: ClipboardList },
  { title: 'Contracts', url: '/contracts', icon: DollarSign },
  { title: 'Contract Compliance', url: '/contract-compliance', icon: Shield },
  { title: 'Teams', url: '/teams', icon: Users },
  { title: 'Roster', url: '/roster', icon: UserCheck },
  { title: 'Schedule', url: '/schedule', icon: ClipboardList },
  { title: 'Events', url: '/events', icon: CalendarDays },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Payments', url: '/payments', icon: CreditCard },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const coachMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Bulletin', url: '/bulletin', icon: Megaphone },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'My Sessions', url: '/sessions', icon: ClipboardList },
  { title: 'Attendance', url: '/attendance', icon: UserCheck },
  { title: 'Contract Compliance', url: '/contract-compliance', icon: Shield },
];

const parentMenuItems = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Bulletin', url: '/bulletin', icon: Megaphone },
  { title: 'My Athletes', url: '/athletes', icon: Users },
  { title: 'Contracts', url: '/contracts', icon: FileText },
  { title: 'Schedule', url: '/schedule', icon: Calendar },
  { title: 'Payments', url: '/payments', icon: CreditCard },
  { title: 'Forms & Links', url: '/forms', icon: Link2 },
];

const athleteMenuItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Bulletin', url: '/bulletin', icon: Megaphone },
  { title: 'My Schedule', url: '/schedule', icon: Calendar },
];

const ownerMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'All Clubs', url: '/clubs', icon: Building2 },
  { title: 'Clubs Billing', url: '/clubs-billing', icon: CreditCard },
  { title: 'Revenue', url: '/revenue', icon: TrendingUp },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, club, logout } = useAuth();

  const menuItems = user?.role === 'owner'
    ? ownerMenuItems
    : user?.role === 'admin'
    ? adminMenuItems
    : user?.role === 'coach'
    ? coachMenuItems
    : user?.role === 'athlete'
    ? athleteMenuItems
    : parentMenuItems;

  const getInitials = (name: string | undefined | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" data-testid="link-home">
          <img 
            src={visioSquadLogo} 
            alt="VisioSquad" 
            className="w-full h-auto dark:invert"
            data-testid="img-sidebar-logo"
          />
        </Link>
        <div className="text-xs text-muted-foreground mt-2">{user?.role === 'owner' ? 'Platform Owner' : (club?.name || 'Sports Club')}</div>
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
