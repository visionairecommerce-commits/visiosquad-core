import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, DollarSign, TrendingUp, Activity, ChevronRight, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClubWithStats {
  id: string;
  name: string;
  sport: string;
  address?: string;
  join_code: string;
  onboarding_complete: boolean;
  billing_method?: string;
  billing_card_last_four?: string;
  billing_bank_last_four?: string;
  created_at: string;
  total_athletes: number;
  active_athletes: number;
  estimated_monthly_revenue: number;
}

interface PlatformMetrics {
  total_clubs: number;
  total_athletes: number;
  active_athletes: number;
  total_payments: number;
  estimated_monthly_revenue: number;
  platform_fee_monthly: number;
  platform_fee_clinic: number;
  platform_fee_drop_in: number;
}

interface ClubDetails {
  id: string;
  name: string;
  sport: string;
  address?: string;
  join_code: string;
  onboarding_complete: boolean;
  billing_method?: string;
  billing_card_last_four?: string;
  billing_bank_last_four?: string;
  created_at: string;
  stats: {
    total_athletes: number;
    active_athletes: number;
    total_payments: number;
    total_programs: number;
    total_teams: number;
    estimated_monthly_revenue: number;
  };
  recent_payments: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    payment_method?: string;
  }>;
}

function formatSport(sport: string): string {
  const sportMap: Record<string, string> = {
    soccer: "Soccer",
    football: "Football",
    basketball: "Basketball",
    indoor_volleyball: "Indoor Volleyball",
    beach_volleyball: "Beach Volleyball",
  };
  return sportMap[sport] || sport;
}

export default function OwnerDashboard() {
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery<PlatformMetrics>({
    queryKey: ["/api/owner/metrics"],
  });

  const { data: clubs, isLoading: clubsLoading } = useQuery<ClubWithStats[]>({
    queryKey: ["/api/owner/clubs"],
  });

  const { data: clubDetails, isLoading: detailsLoading } = useQuery<ClubDetails>({
    queryKey: ["/api/owner/clubs", selectedClubId],
    enabled: !!selectedClubId,
  });

  if (metricsLoading || clubsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-owner-dashboard">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="owner-dashboard">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Platform Owner Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor all clubs, athletes, and platform revenue
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-clubs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clubs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clubs">
              {metrics?.total_clubs ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active sports organizations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-athletes">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-athletes">
              {metrics?.total_athletes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.active_athletes ?? 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-revenue">
              ${metrics?.estimated_monthly_revenue?.toFixed(2) ?? "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on ${metrics?.platform_fee_monthly ?? 3}/player/month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-payments">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">
              {metrics?.total_payments ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Processed transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-platform-fees">
        <CardHeader>
          <CardTitle>Platform Fee Structure</CardTitle>
          <CardDescription>Current pricing for all clubs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Monthly Fee</p>
                <p className="text-2xl font-bold text-primary">${metrics?.platform_fee_monthly ?? 3.00}</p>
                <p className="text-sm text-muted-foreground">Per player/month</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Clinic Fee</p>
                <p className="text-2xl font-bold text-primary">${metrics?.platform_fee_clinic ?? 1.00}</p>
                <p className="text-sm text-muted-foreground">Per participant</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Drop-in Fee</p>
                <p className="text-2xl font-bold text-primary">${metrics?.platform_fee_drop_in ?? 0.75}</p>
                <p className="text-sm text-muted-foreground">Per session</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-clubs-list">
        <CardHeader>
          <CardTitle>All Clubs</CardTitle>
          <CardDescription>
            Monitor performance and billing status for all registered clubs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clubs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clubs registered yet
            </div>
          ) : (
            <div className="space-y-4">
              {clubs?.map((club) => (
                <div
                  key={club.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => setSelectedClubId(club.id)}
                  data-testid={`row-club-${club.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-club-name-${club.id}`}>{club.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{formatSport(club.sport)}</Badge>
                        <span>Code: {club.join_code}</span>
                        {!club.onboarding_complete && (
                          <Badge variant="secondary">Setup incomplete</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium" data-testid={`text-athletes-${club.id}`}>{club.total_athletes} athletes</p>
                      <p className="text-sm text-muted-foreground">
                        {club.active_athletes} active
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600 dark:text-green-400" data-testid={`text-revenue-${club.id}`}>
                        ${club.estimated_monthly_revenue.toFixed(2)}/mo
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {club.billing_method ? (
                          <span className="flex items-center gap-1">
                            {club.billing_method === "credit_card" ? "Card" : "Bank"}
                            {" ending "}
                            {club.billing_card_last_four || club.billing_bank_last_four}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">No billing</span>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" data-testid={`button-view-club-${club.id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedClubId} onOpenChange={(open) => !open && setSelectedClubId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {clubDetails?.name ?? "Club Details"}
            </DialogTitle>
            <DialogDescription>
              Detailed information about this club
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          ) : clubDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Sport</p>
                  <p className="font-medium">{formatSport(clubDetails.sport)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Join Code</p>
                  <p className="font-medium">{clubDetails.join_code}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(clubDetails.created_at), "MMM d, yyyy")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={clubDetails.onboarding_complete ? "default" : "secondary"}>
                    {clubDetails.onboarding_complete ? "Active" : "Setup Incomplete"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{clubDetails.stats.total_athletes}</div>
                    <p className="text-sm text-muted-foreground">Total Athletes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{clubDetails.stats.total_programs}</div>
                    <p className="text-sm text-muted-foreground">Programs</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{clubDetails.stats.total_teams}</div>
                    <p className="text-sm text-muted-foreground">Teams</p>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Billing Information</h4>
                  <Badge variant={clubDetails.billing_method ? "default" : "destructive"}>
                    {clubDetails.billing_method ? "Configured" : "Not Configured"}
                  </Badge>
                </div>
                {clubDetails.billing_method ? (
                  <p className="text-sm text-muted-foreground">
                    {clubDetails.billing_method === "credit_card" ? "Credit Card" : "Bank Account"} ending in{" "}
                    {clubDetails.billing_card_last_four || clubDetails.billing_bank_last_four}
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    This club has not configured a billing method yet
                  </p>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Revenue Estimate</h4>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${clubDetails.stats.estimated_monthly_revenue.toFixed(2)}/month
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on {clubDetails.stats.active_athletes} active athletes
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
