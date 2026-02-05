import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Landmark, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Receipt
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { useState, useMemo } from "react";

interface RevenueMetrics {
  total_tech_fees: number;
  total_payments: number;
  payment_count: number;
  avg_fee_per_payment: number;
  by_payment_rail: {
    card_credit: { count: number; total: number };
    card_debit: { count: number; total: number };
    ach: { count: number; total: number };
  };
  by_payment_kind: {
    recurring: { count: number; total: number };
    one_time: { count: number; total: number };
  };
  trend_vs_previous: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  base_amount: number;
  tech_fee_amount: number;
  payment_rail: string;
  payment_kind: string;
  fee_version: string;
  status: string;
  created_at: string;
  club_name: string;
  athlete_name: string;
}

export default function PlatformRevenuePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  
  const periodDates = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case "previous":
        return {
          start: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
          end: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
          label: format(subMonths(now, 1), "MMMM yyyy"),
        };
      case "last3":
        return {
          start: format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd"),
          end: format(endOfMonth(now), "yyyy-MM-dd"),
          label: `${format(subMonths(now, 3), "MMM")} - ${format(now, "MMM yyyy")}`,
        };
      default:
        return {
          start: format(startOfMonth(now), "yyyy-MM-dd"),
          end: format(endOfMonth(now), "yyyy-MM-dd"),
          label: format(now, "MMMM yyyy"),
        };
    }
  }, [selectedPeriod]);

  const { data: metrics, isLoading: metricsLoading } = useQuery<RevenueMetrics>({
    queryKey: ["/api/owner/revenue/metrics", periodDates.start, periodDates.end],
    queryFn: async () => {
      const res = await fetch(
        `/api/owner/revenue/metrics?start=${periodDates.start}&end=${periodDates.end}`
      );
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });

  const { data: recentPayments, isLoading: paymentsLoading } = useQuery<RecentPayment[]>({
    queryKey: ["/api/owner/revenue/payments", periodDates.start, periodDates.end],
    queryFn: async () => {
      const res = await fetch(
        `/api/owner/revenue/payments?start=${periodDates.start}&end=${periodDates.end}&limit=20`
      );
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const formatPaymentRail = (rail: string) => {
    switch (rail) {
      case "card_credit": return "Credit Card";
      case "card_debit": return "Debit Card";
      case "ach": return "ACH";
      default: return rail;
    }
  };

  const getRailIcon = (rail: string) => {
    if (rail === "ach") return <Landmark className="h-4 w-4" />;
    return <CreditCard className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Revenue</h1>
          <p className="text-muted-foreground">
            Technology and Service Fees collected from parent payments
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]" data-testid="select-period">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">This Month</SelectItem>
            <SelectItem value="previous">Last Month</SelectItem>
            <SelectItem value="last3">Last 3 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Showing data for: {periodDates.label}</span>
      </div>

      {metricsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tech Fees
              </CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(metrics?.total_tech_fees ?? 0).toFixed(2)}
              </div>
              {metrics?.trend_vs_previous !== undefined && (
                <div className={`flex items-center text-xs ${
                  metrics.trend_vs_previous >= 0 ? "text-accent" : "text-destructive"
                }`}>
                  {metrics.trend_vs_previous >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(metrics.trend_vs_previous).toFixed(1)}% vs previous
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payments Processed
              </CardTitle>
              <Receipt className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.payment_count ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                ${(metrics?.total_payments ?? 0).toFixed(2)} total volume
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Fee/Payment
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(metrics?.avg_fee_per_payment ?? 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Per transaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fee Version
              </CardTitle>
              <Users className="h-4 w-4 text-chart-3" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">v2_2026_02</div>
              <Badge variant="secondary" className="text-xs">
                Zero-Loss Discounts
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Payment Method</CardTitle>
            <CardDescription>Breakdown by payment rail</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { key: "card_credit", label: "Credit Card", icon: CreditCard },
                  { key: "card_debit", label: "Debit Card", icon: CreditCard },
                  { key: "ach", label: "ACH / Bank", icon: Landmark },
                ].map(({ key, label, icon: Icon }) => {
                  const data = metrics?.by_payment_rail?.[key as keyof typeof metrics.by_payment_rail];
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">
                            {data?.count ?? 0} payments
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          ${(data?.total ?? 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">in fees</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Payment Type</CardTitle>
            <CardDescription>Recurring vs one-time payments</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">Recurring (Contracts)</div>
                    <Badge>
                      {metrics?.by_payment_kind?.recurring?.count ?? 0} payments
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    ${(metrics?.by_payment_kind?.recurring?.total ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    3.75% + $3.50/mo (credit) · Flat $3.50/mo (debit) · 1.75% + $3.00/mo (ACH)
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">One-Time (Events/Drop-ins)</div>
                    <Badge variant="secondary">
                      {metrics?.by_payment_kind?.one_time?.count ?? 0} payments
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-accent">
                    ${(metrics?.by_payment_kind?.one_time?.total ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    3.75% + $1.50 (credit) · Flat $1.50 (debit) · 1.75% + $1.00 (ACH)
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
          <CardDescription>Latest transactions with fee breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentPayments && recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`payment-row-${payment.id}`}
                >
                  <div className="flex items-center gap-3">
                    {getRailIcon(payment.payment_rail)}
                    <div>
                      <div className="font-medium">{payment.athlete_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {payment.club_name} • {format(new Date(payment.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${payment.tech_fee_amount.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      of ${payment.amount.toFixed(2)} total
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {formatPaymentRail(payment.payment_rail)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No payments found for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
