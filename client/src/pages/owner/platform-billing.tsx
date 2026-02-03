import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  DollarSign,
  CreditCard,
  Landmark,
  Play,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
} from "lucide-react";

interface BillingPreview {
  period_start: string;
  period_end: string;
  payment_method: string;
  clubs: Array<{
    club_id: string;
    club_name: string;
    ledger_line_count: number;
    subtotal: number;
    fee: number;
    total: number;
    has_billing_token: boolean;
    can_charge: boolean;
  }>;
  total_clubs: number;
  total_billable: number;
  total_amount: number;
}

interface BillingResult {
  period_start: string;
  period_end: string;
  payment_method: string;
  results: Array<{
    club_id: string;
    club_name: string;
    status: 'paid' | 'failed' | 'skipped';
    invoice_id?: string;
    amount?: number;
    error?: string;
  }>;
  summary: {
    total_clubs: number;
    paid: number;
    failed: number;
    skipped: number;
    total_collected: number;
  };
}

interface PlatformInvoice {
  id: string;
  club_id: string;
  club_name: string;
  period_start: string;
  period_end: string;
  subtotal_amount: number;
  fee_amount: number;
  total_amount: number;
  payment_method: 'credit_card' | 'ach';
  status: 'draft' | 'paid' | 'failed';
  helcim_transaction_id: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

export default function PlatformBillingPage() {
  const { toast } = useToast();
  const lastMonth = subMonths(new Date(), 1);
  
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'ach'>('credit_card');
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [results, setResults] = useState<BillingResult | null>(null);

  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery<PlatformInvoice[]>({
    queryKey: ['/api/platform/billing/invoices', periodStart, periodEnd],
    queryFn: async () => {
      const res = await fetch(`/api/platform/billing/invoices?periodStart=${periodStart}&periodEnd=${periodEnd}`, {
        headers: {
          'X-User-Role': 'owner',
          'X-User-Id': 'owner',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/platform/billing/preview', { periodStart, periodEnd, paymentMethod });
      return res.json() as Promise<BillingPreview>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setResults(null);
      toast({ title: "Preview generated", description: `Found ${data.total_clubs} clubs with billable amounts` });
    },
    onError: (error: Error) => {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  const runBillingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/platform/billing/run', { periodStart, periodEnd, paymentMethod });
      return res.json() as Promise<BillingResult>;
    },
    onSuccess: (data) => {
      setResults(data);
      setPreview(null);
      refetchInvoices();
      toast({ 
        title: "Billing completed", 
        description: `${data.summary.paid} paid, ${data.summary.failed} failed, ${data.summary.skipped} skipped` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Billing run failed", description: error.message, variant: "destructive" });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest(`/api/platform/billing/charge/${invoiceId}`, {
        method: 'POST',
      });
      return res;
    },
    onSuccess: (data: any) => {
      refetchInvoices();
      if (data.success) {
        toast({ title: "Retry successful", description: "Payment processed successfully" });
      } else {
        toast({ title: "Retry failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" });
    },
  });

  const seedTestDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/platform/billing/test-seed');
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Test data seeded", 
        description: `Created ${data.entries_created} ledger entries for ${data.club_name}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-accent/10 text-accent gap-1"><CheckCircle className="h-3 w-3" />Paid</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      case 'skipped':
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />Skipped</Badge>;
      case 'draft':
        return <Badge variant="outline" className="gap-1">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Billing</h1>
          <p className="text-muted-foreground">
            Bill clubs for platform fees based on their athlete activity
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => seedTestDataMutation.mutate()}
          disabled={seedTestDataMutation.isPending}
          data-testid="button-seed-test-data"
        >
          {seedTestDataMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Seed Test Data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Billing Configuration
          </CardTitle>
          <CardDescription>
            Select the billing period and payment method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                data-testid="input-period-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                data-testid="input-period-end"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'credit_card' | 'ach')}>
                <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Credit Card (3% fee)
                    </span>
                  </SelectItem>
                  <SelectItem value="ach">
                    <span className="flex items-center gap-2">
                      <Landmark className="h-4 w-4" />
                      ACH ($1.00 fee)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                variant="outline"
                className="flex-1"
                data-testid="button-preview"
              >
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Preview
              </Button>
              <Button 
                onClick={() => runBillingMutation.mutate()}
                disabled={runBillingMutation.isPending}
                className="flex-1"
                data-testid="button-run-billing"
              >
                {runBillingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run Billing
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Preview</CardTitle>
            <CardDescription>
              Period: {preview.period_start} to {preview.period_end} | Method: {preview.payment_method === 'credit_card' ? 'Credit Card' : 'ACH'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{preview.total_clubs}</div>
                  <p className="text-sm text-muted-foreground">Total Clubs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{preview.total_billable}</div>
                  <p className="text-sm text-muted-foreground">Billable Clubs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-accent">${preview.total_amount.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </CardContent>
              </Card>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.clubs.map((club) => (
                  <TableRow key={club.club_id}>
                    <TableCell className="font-medium">{club.club_name}</TableCell>
                    <TableCell className="text-right">{club.ledger_line_count}</TableCell>
                    <TableCell className="text-right">${club.subtotal.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${club.fee.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${club.total.toFixed(2)}</TableCell>
                    <TableCell>
                      {club.can_charge ? (
                        <Badge className="bg-accent/10 text-accent">Ready</Badge>
                      ) : (
                        <Badge variant="secondary">No Token</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Results</CardTitle>
            <CardDescription>
              Period: {results.period_start} to {results.period_end}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-accent">{results.summary.paid}</div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-destructive">{results.summary.failed}</div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{results.summary.skipped}</div>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-accent">${results.summary.total_collected.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Collected</p>
                </CardContent>
              </Card>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.results.map((result) => (
                  <TableRow key={result.club_id}>
                    <TableCell className="font-medium">{result.club_name}</TableCell>
                    <TableCell>{getStatusBadge(result.status)}</TableCell>
                    <TableCell className="text-right">
                      {result.amount ? `$${result.amount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {result.error || (result.invoice_id ? `Invoice: ${result.invoice_id.slice(0, 8)}...` : '-')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
          <CardDescription>
            Invoices for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices && invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.club_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invoice.period_start), 'MMM d')} - {format(new Date(invoice.period_end), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {invoice.payment_method === 'credit_card' ? (
                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Card</span>
                      ) : (
                        <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> ACH</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">${invoice.subtotal_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${invoice.fee_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryMutation.mutate(invoice.id)}
                          disabled={retryMutation.isPending}
                          data-testid={`button-retry-${invoice.id}`}
                        >
                          {retryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No invoices found for the selected period. Run billing to create invoices.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
