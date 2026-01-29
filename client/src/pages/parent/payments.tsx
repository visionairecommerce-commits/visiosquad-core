import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAthlete } from '@/contexts/AthleteContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import { isAthleteAccessLocked, calculateConvenienceFee } from '@shared/schema';
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Landmark,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

interface Payment {
  id: string;
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  method: 'credit_card' | 'ach' | 'cash';
}

const paymentHistory: Payment[] = [
  { id: '1', description: 'Monthly Membership - January', amount: 154.50, status: 'completed', date: '2026-01-15', method: 'credit_card' },
  { id: '2', description: 'Skills Clinic Registration', amount: 51.50, status: 'completed', date: '2026-01-10', method: 'credit_card' },
  { id: '3', description: 'Monthly Membership - December', amount: 150, status: 'completed', date: '2025-12-15', method: 'ach' },
  { id: '4', description: 'Drop-in Session', amount: 15, status: 'completed', date: '2025-12-08', method: 'credit_card' },
];

export default function ParentPaymentsPage() {
  const { activeAthlete, athletes } = useAthlete();

  const isLocked = activeAthlete ? isAthleteAccessLocked(activeAthlete.paid_through_date ?? undefined) : false;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-accent/10 text-accent gap-1"><CheckCircle className="h-3 w-3" />Paid</Badge>;
      case 'pending':
        return <Badge className="bg-chart-3/10 text-chart-3 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return null;
    }
  };

  const getMethodIcon = (method: string) => {
    return <CreditCard className="h-4 w-4 text-muted-foreground" />;
  };

  const totalSpent = paymentHistory
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            View payment history and manage billing
          </p>
        </div>
        <AthleteSwitcher />
      </div>

      {isLocked && activeAthlete && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Payment Required</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeAthlete.first_name}'s account is past due. Update your payment method to continue registering for sessions.
                </p>
                <Button className="mt-4" data-testid="button-update-payment">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Payment Method
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This season</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Athletes
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{athletes.length}</div>
            <p className="text-xs text-muted-foreground">In your family</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment Status
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">Current</div>
            <p className="text-xs text-muted-foreground">All payments up to date</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
          <CardDescription>Recent transactions and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentHistory.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-3">
                  {getMethodIcon(payment.method)}
                  <div>
                    <div className="font-medium">{payment.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(payment.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">${payment.amount.toFixed(2)}</span>
                  {getStatusBadge(payment.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Methods</CardTitle>
          <CardDescription>Manage your saved payment methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              A <strong>3% convenience fee</strong> is applied to Credit Card payments. 
              A <strong>$1.00 processing fee</strong> is applied to ACH payments. 
              These fees ensure the club receives 100% of your tuition.
            </AlertDescription>
          </Alert>
          <div className="flex items-center justify-between p-4 rounded-md border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">Visa ending in 4242</div>
                <div className="text-sm text-muted-foreground">Expires 12/27</div>
                <div className="text-xs text-chart-3">3% convenience fee applies</div>
              </div>
            </div>
            <Badge variant="secondary">Default</Badge>
          </div>
          <Button variant="outline" className="w-full" data-testid="button-add-payment-method">
            <CreditCard className="h-4 w-4 mr-2" />
            Add Credit Card
          </Button>
          <Button variant="outline" className="w-full" data-testid="button-add-bank-account">
            <Landmark className="h-4 w-4 mr-2" />
            Add Bank Account ($1.00 fee)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
