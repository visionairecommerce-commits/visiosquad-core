import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cashPaymentSchema, type CashPayment, PLATFORM_FEES } from '@shared/schema';
import { DollarSign, CreditCard, AlertCircle, CheckCircle, Clock, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths } from 'date-fns';

interface Payment {
  id: string;
  athlete_name: string;
  family_name: string;
  amount: number;
  payment_type: 'monthly' | 'clinic' | 'drop_in' | 'cash';
  status: 'completed' | 'pending' | 'failed';
  date: string;
}

interface Athlete {
  id: string;
  name: string;
  family_name: string;
  paid_through_date: string | null;
}

const athletes: Athlete[] = [
  { id: '1', name: 'Emma Wilson', family_name: 'Wilson', paid_through_date: '2026-02-15' },
  { id: '2', name: 'Jake Thompson', family_name: 'Thompson', paid_through_date: '2026-01-10' },
  { id: '3', name: 'Sophia Garcia', family_name: 'Garcia', paid_through_date: null },
  { id: '4', name: 'Liam Martinez', family_name: 'Martinez', paid_through_date: '2026-01-05' },
];

const initialPayments: Payment[] = [
  { id: '1', athlete_name: 'Emma Wilson', family_name: 'Wilson', amount: 150, payment_type: 'monthly', status: 'completed', date: '2026-01-20' },
  { id: '2', athlete_name: 'Jake Thompson', family_name: 'Thompson', amount: 154.50, payment_type: 'monthly', status: 'completed', date: '2026-01-18' },
  { id: '3', athlete_name: 'Sophia Garcia', family_name: 'Garcia', amount: 50, payment_type: 'clinic', status: 'pending', date: '2026-01-22' },
  { id: '4', athlete_name: 'Liam Martinez', family_name: 'Martinez', amount: 150, payment_type: 'monthly', status: 'failed', date: '2026-01-15' },
];

const stats = [
  { title: 'Monthly Revenue', value: '$12,450', icon: DollarSign, change: '+8%' },
  { title: 'Platform Fees', value: '$127', icon: CreditCard, description: 'This month' },
  { title: 'Pending', value: '$450', icon: Clock, description: '3 payments' },
  { title: 'Failed', value: '$150', icon: AlertCircle, description: '1 payment' },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CashPayment>({
    resolver: zodResolver(cashPaymentSchema),
    defaultValues: {
      athlete_id: '',
      months: 1,
    },
  });

  const onSubmit = (data: CashPayment) => {
    const athlete = athletes.find(a => a.id === data.athlete_id);
    if (!athlete) return;

    const platformFee = PLATFORM_FEES.monthly * data.months;

    const newPayment: Payment = {
      id: String(payments.length + 1),
      athlete_name: athlete.name,
      family_name: athlete.family_name,
      amount: 150 * data.months,
      payment_type: 'cash',
      status: 'completed',
      date: format(new Date(), 'yyyy-MM-dd'),
    };

    setPayments([newPayment, ...payments]);
    setDialogOpen(false);
    form.reset();

    toast({
      title: 'Cash Payment Recorded',
      description: `${athlete.name} is now paid through ${format(addMonths(new Date(), data.months), 'MMM yyyy')}. Platform fee of $${platformFee.toFixed(2)} recorded.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-accent/10 text-accent gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-chart-3/10 text-chart-3 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Banknote className="h-4 w-4 text-accent" />;
      default:
        return <CreditCard className="h-4 w-4 text-primary" />;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const completedPayments = payments.filter(p => p.status === 'completed');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const failedPayments = payments.filter(p => p.status === 'failed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track payments and manage billing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-mark-cash-paid">
              <Banknote className="h-4 w-4 mr-2" />
              Mark as Paid - Cash
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Cash Payment</DialogTitle>
              <DialogDescription>
                Mark an athlete as paid with cash. A platform fee of ${PLATFORM_FEES.monthly}/month will be recorded.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="athlete_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Athlete</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-cash-athlete">
                            <SelectValue placeholder="Select athlete" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {athletes.map((athlete) => (
                            <SelectItem key={athlete.id} value={athlete.id}>
                              {athlete.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Months</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          data-testid="input-cash-months"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded-md bg-muted p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Platform fee:</span>
                    <span className="font-medium">${(PLATFORM_FEES.monthly * (form.watch('months') || 1)).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be recorded in the platform ledger
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-cash">
                    Record Payment
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.change && (
                <p className="text-xs text-accent">{stat.change} from last month</p>
              )}
              {stat.description && (
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-payments">
            All
            <Badge variant="secondary" className="ml-2">{payments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-payments">
            Pending
            {pendingPayments.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingPayments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="failed" data-testid="tab-failed-payments">
            Failed
            {failedPayments.length > 0 && (
              <Badge variant="destructive" className="ml-2">{failedPayments.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Payments</CardTitle>
              <CardDescription>Complete payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(payment.athlete_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {payment.athlete_name}
                          {getTypeIcon(payment.payment_type)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.family_name} Family • {format(new Date(payment.date), 'MMM d, yyyy')}
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
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Payments</CardTitle>
              <CardDescription>Payments awaiting confirmation</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No pending payments</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(payment.athlete_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{payment.athlete_name}</div>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Failed Payments</CardTitle>
              <CardDescription>Payments that require attention</CardDescription>
            </CardHeader>
            <CardContent>
              {failedPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No failed payments</p>
              ) : (
                <div className="space-y-3">
                  {failedPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(payment.athlete_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{payment.athlete_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(payment.date), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">${payment.amount.toFixed(2)}</span>
                        {getStatusBadge(payment.status)}
                        <Button size="sm" variant="outline" data-testid={`button-retry-${payment.id}`}>
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
