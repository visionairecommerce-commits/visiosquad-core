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
import { DollarSign, CreditCard, AlertCircle, CheckCircle, Clock, Banknote, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Payment {
  id: string;
  athlete_id: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
  payment_method: string;
}

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  paid_through_date: string | null;
}

export default function PaymentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: athletes = [], isLoading: athletesLoading } = useQuery<Athlete[]>({
    queryKey: ['/api/athletes'],
  });

  const cashPaymentMutation = useMutation({
    mutationFn: async (data: CashPayment) => {
      const response = await apiRequest('POST', '/api/payments/cash', data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      const athlete = athletes.find(a => a.id === variables.athlete_id);
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/athletes'] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: 'Cash Payment Recorded',
        description: athlete ? `${athlete.first_name} ${athlete.last_name} is now paid through ${format(addMonths(new Date(), variables.months), 'MMM yyyy')}.` : 'Payment recorded successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to record payment',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<CashPayment>({
    resolver: zodResolver(cashPaymentSchema),
    defaultValues: {
      athlete_id: '',
      months: 1,
    },
  });

  const onSubmit = (data: CashPayment) => {
    cashPaymentMutation.mutate(data);
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
        return <Badge variant="secondary">{status}</Badge>;
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAthleteName = (athleteId: string) => {
    const athlete = athletes.find(a => a.id === athleteId);
    return athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Unknown';
  };

  const completedPayments = payments.filter(p => p.status === 'completed');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const failedPayments = payments.filter(p => p.status === 'failed');

  const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const failedAmount = failedPayments.reduce((sum, p) => sum + p.amount, 0);

  const isLoading = paymentsLoading || athletesLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track payments and manage billing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-mark-cash-paid" disabled={athletes.length === 0}>
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
                              {athlete.first_name} {athlete.last_name}
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
                  <Button type="submit" disabled={cashPaymentMutation.isPending} data-testid="button-submit-cash">
                    {cashPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Record Payment
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Athletes
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{athletes.length}</div>
            <p className="text-xs text-muted-foreground">Registered athletes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${failedAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{failedPayments.length} payment{failedPayments.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
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
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No payments recorded yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payments will appear here once transactions are processed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const athlete = athletes.find(a => a.id === payment.athlete_id);
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {athlete ? getInitials(athlete.first_name, athlete.last_name) : '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {getAthleteName(payment.athlete_id)}
                              {getTypeIcon(payment.payment_method)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {payment.description} • {format(new Date(payment.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">${payment.amount.toFixed(2)}</span>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No pending payments</p>
              ) : (
                <div className="space-y-3">
                  {pendingPayments.map((payment) => {
                    const athlete = athletes.find(a => a.id === payment.athlete_id);
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {athlete ? getInitials(athlete.first_name, athlete.last_name) : '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{getAthleteName(payment.athlete_id)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">${payment.amount.toFixed(2)}</span>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    );
                  })}
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
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : failedPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No failed payments</p>
              ) : (
                <div className="space-y-3">
                  {failedPayments.map((payment) => {
                    const athlete = athletes.find(a => a.id === payment.athlete_id);
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {athlete ? getInitials(athlete.first_name, athlete.last_name) : '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{getAthleteName(payment.athlete_id)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">${payment.amount.toFixed(2)}</span>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
