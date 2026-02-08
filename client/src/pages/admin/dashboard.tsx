import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ClubProfileCard } from '@/components/club-profile-card';
import {
  Users,
  Calendar,
  DollarSign,
  Plus,
  ArrowRight,
  ClipboardList,
  Copy,
  MessageSquare,
  Share2,
  ExternalLink,
  CreditCard,
  Loader2,
  MapPin,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  UserX,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';

interface DashboardStats {
  totalAthletes: number;
  activePrograms: number;
  thisWeekSessions: number;
}

interface RevenueStats {
  monthlyRevenue: string;
  changePercent: number;
}

interface UpcomingSession {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  teamName?: string;
}

interface PendingPayment {
  athleteId: string;
  athleteName: string;
  amount: string;
  daysOverdue: number;
}

interface RecentActivity {
  type: string;
  message: string;
  time: string;
}

interface AthleteAssignmentOverview {
  totalAthletes: number;
  assignedCount: number;
  unassignedCount: number;
  unassignedAthletes: Array<{ id: string; first_name: string; last_name: string; parent_name: string }>;
  assignmentsByProgram: Array<{ program_id: string; program_name: string; athlete_count: number }>;
}

export default function AdminDashboard() {
  const { club } = useAuth();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    enabled: !!club?.id,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/dashboard/revenue'],
    enabled: !!club?.id,
  });

  const { data: upcomingSessions = [], isLoading: sessionsLoading } = useQuery<UpcomingSession[]>({
    queryKey: ['/api/dashboard/upcoming-sessions'],
    enabled: !!club?.id,
  });

  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery<PendingPayment[]>({
    queryKey: ['/api/dashboard/pending-payments'],
    enabled: !!club?.id,
  });

  const { data: recentActivity = [], isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ['/api/dashboard/recent-activity'],
    enabled: !!club?.id,
  });

  const { data: assignmentOverview, isLoading: assignmentLoading } = useQuery<AthleteAssignmentOverview>({
    queryKey: ['/api/athletes/assignment-overview'],
    enabled: !!club?.id,
  });

  const getInviteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?code=${club?.join_code}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(getInviteLink());
    toast({ title: 'Invite link copied to clipboard!' });
  };

  const copyClubCode = () => {
    if (club?.join_code) {
      navigator.clipboard.writeText(club.join_code);
      toast({ title: 'Club code copied!' });
    }
  };

  const openSmsInvite = () => {
    const message = `Join ${club?.name} on VisioSquad! Use code ${club?.join_code} or click here to sign the waiver and register: ${getInviteLink()}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  };

  const formatSessionTime = (startTime: string) => {
    const date = new Date(startTime);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (isTomorrow) {
      return `Tomorrow, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'EEE, MMM d, h:mm a');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/programs">
            <Button data-testid="button-create-program">
              <Plus className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          </Link>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Share Club Access</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Club Code:</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyClubCode}
              className="font-mono font-bold"
              data-testid="button-copy-code"
            >
              {club?.join_code || 'N/A'}
              <Copy className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={copyInviteLink}
              data-testid="button-copy-invite-link"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
            <Button
              variant="outline"
              onClick={openSmsInvite}
              data-testid="button-sms-invite"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text Invite
              <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Share this code with parents and coaches. They'll use it to join and sign your waiver.
          </p>
        </CardContent>
      </Card>

      {club && <ClubProfileCard club={club} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Athletes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-athletes">
                {stats?.totalAthletes ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Programs
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-active-programs">
                {stats?.activePrograms ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessions This Week
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-sessions-week">
                {stats?.thisWeekSessions ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="stat-monthly-revenue">
                  ${revenue?.monthlyRevenue ?? '0.00'}
                </div>
                {revenue && revenue.changePercent !== 0 && (
                  <div className={`flex items-center text-xs ${revenue.changePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {revenue.changePercent > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {revenue.changePercent > 0 ? '+' : ''}{revenue.changePercent}% from last month
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {!assignmentLoading && assignmentOverview && assignmentOverview.unassignedCount > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-assignment-overview">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <CardTitle className="text-lg">Athletes Need Assignment</CardTitle>
                <CardDescription>
                  {assignmentOverview.unassignedCount} athlete{assignmentOverview.unassignedCount !== 1 ? 's' : ''} not assigned to any program
                </CardDescription>
              </div>
            </div>
            <Link href="/roster">
              <Button variant="outline" size="sm" data-testid="button-assign-athletes">
                Assign Now
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignmentOverview.unassignedAthletes.slice(0, 5).map((athlete) => (
                <div 
                  key={athlete.id} 
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-background border"
                  data-testid={`unassigned-athlete-${athlete.id}`}
                >
                  <div>
                    <span className="font-medium">{athlete.first_name} {athlete.last_name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      (Parent: {athlete.parent_name})
                    </span>
                  </div>
                </div>
              ))}
              {assignmentOverview.unassignedCount > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{assignmentOverview.unassignedCount - 5} more unassigned athlete{assignmentOverview.unassignedCount - 5 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!assignmentLoading && assignmentOverview && assignmentOverview.assignmentsByProgram.length > 0 && (
        <Card data-testid="card-program-assignments">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-lg">Program Assignments</CardTitle>
                <CardDescription>
                  {assignmentOverview.assignedCount} athlete{assignmentOverview.assignedCount !== 1 ? 's' : ''} assigned across {assignmentOverview.assignmentsByProgram.length} program{assignmentOverview.assignmentsByProgram.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignmentOverview.assignmentsByProgram.map((program) => (
                <div 
                  key={program.program_id} 
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 border"
                  data-testid={`program-assignment-${program.program_id}`}
                >
                  <span className="font-medium">{program.program_name}</span>
                  <Badge variant="secondary">{program.athlete_count} athlete{program.athlete_count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
              <CardDescription>Next 7 days</CardDescription>
            </div>
            <Link href="/schedule">
              <Button variant="ghost" size="sm" data-testid="link-view-all-sessions">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming sessions scheduled
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`session-${session.id}`}
                  >
                    <div>
                      <div className="font-medium">{session.title}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatSessionTime(session.startTime)}
                        {session.location && (
                          <>
                            <span className="mx-1">-</span>
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Pending Payments</CardTitle>
              <CardDescription>Overdue balances</CardDescription>
            </div>
            <Link href="/payments">
              <Button variant="ghost" size="sm" data-testid="link-view-all-payments">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending payments
              </p>
            ) : (
              <div className="space-y-3">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.athleteId}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`pending-payment-${payment.athleteId}`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="font-medium">{payment.athleteName}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.daysOverdue} day{payment.daysOverdue !== 1 ? 's' : ''} overdue
                        </div>
                      </div>
                    </div>
                    <div className="font-medium">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest updates from your club</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-4 py-2" data-testid={`activity-${i}`}>
                  <div className={`h-2 w-2 rounded-full ${
                    activity.type === 'payment' ? 'bg-green-500' :
                    activity.type === 'registration' ? 'bg-blue-500' :
                    activity.type === 'event' ? 'bg-purple-500' :
                    activity.type === 'session' ? 'bg-orange-500' :
                    'bg-primary'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm">{activity.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
