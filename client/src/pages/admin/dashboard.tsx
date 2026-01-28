import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  Copy,
  MessageSquare,
  Share2,
  ExternalLink,
  CreditCard,
} from 'lucide-react';

const stats = [
  { title: 'Total Athletes', value: '127', change: '+12%', icon: Users },
  { title: 'Active Programs', value: '8', change: '+2', icon: ClipboardList },
  { title: 'This Week Sessions', value: '24', change: '+4', icon: Calendar },
  { title: 'Monthly Revenue', value: '$12,450', change: '+8%', icon: DollarSign },
];

const recentActivity = [
  { type: 'registration', message: 'Emma Wilson registered for Summer Camp', time: '2 hours ago' },
  { type: 'payment', message: 'Payment received from Davis family', time: '3 hours ago' },
  { type: 'contract', message: 'Contract signed for Jake Thompson', time: '5 hours ago' },
  { type: 'session', message: 'Practice scheduled for Team A', time: '1 day ago' },
];

const upcomingSessions = [
  { title: 'Team A Practice', time: 'Today, 4:00 PM', athletes: 12, location: 'Field 1' },
  { title: 'Beginner Clinic', time: 'Tomorrow, 10:00 AM', athletes: 8, location: 'Indoor Court' },
  { title: 'Team B Practice', time: 'Wed, 5:00 PM', athletes: 15, location: 'Field 2' },
];

const pendingPayments = [
  { name: 'Johnson Family', amount: '$150', daysOverdue: 5 },
  { name: 'Martinez Family', amount: '$200', daysOverdue: 3 },
];

interface BillingStatus {
  has_billing_method: boolean;
  billing_method: 'card' | 'bank' | null;
  card_last_four: string | null;
  bank_last_four: string | null;
}

export default function AdminDashboard() {
  const { club } = useAuth();
  const { toast } = useToast();

  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ['/api/clubs', club?.id, 'billing'],
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
    const message = `Join ${club?.name} on VisioSport! Use code ${club?.join_code} or click here to sign the waiver and register: ${getInviteLink()}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
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

      {billingStatus && !billingStatus.has_billing_method && (
        <Card className="border-2 border-destructive bg-destructive/5" data-testid="card-billing-required">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-destructive/10">
                <CreditCard className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-destructive">Add Payment Method to Start Billing</CardTitle>
                <CardDescription className="text-destructive/80">
                  Required before you can charge clients for programs and sessions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add a credit card or bank account to cover platform fees ($2.00/month per athlete, $1.00 per player per clinic, $0.75 per drop-in). This is required before you can process any client payments.
            </p>
            <Link href="/settings">
              <Button size="lg" data-testid="button-add-billing-method">
                <CreditCard className="h-5 w-5 mr-2" />
                Add Payment Method Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-xs text-accent">
                <TrendingUp className="h-3 w-3 mr-1" />
                {stat.change} from last month
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <div className="space-y-3">
              {upcomingSessions.map((session, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{session.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {session.time} • {session.location}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {session.athletes}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Pending Payments</CardTitle>
              <CardDescription>Requires attention</CardDescription>
            </div>
            <Link href="/payments">
              <Button variant="ghost" size="sm" data-testid="link-view-all-payments">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingPayments.map((payment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <div>
                      <div className="font-medium">{payment.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {payment.daysOverdue} days overdue
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{payment.amount}</span>
                    <Button size="sm" variant="outline" data-testid={`button-mark-paid-${i}`}>
                      Mark Paid
                    </Button>
                  </div>
                </div>
              ))}
              {pendingPayments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending payments
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest updates from your club</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm">{activity.message}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
