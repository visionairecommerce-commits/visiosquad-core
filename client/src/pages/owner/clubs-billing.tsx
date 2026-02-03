import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Lock, Unlock, DollarSign, Calendar, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClubBillingStatus {
  id: string;
  name: string;
  sport: string;
  billing_day: number | null;
  billing_locked_at: string | null;
  last_billed_at: string | null;
  last_billed_period_start: string | null;
  billing_method: string | null;
  billing_card_last_four: string | null;
  billing_bank_last_four: string | null;
  activeAthleteCount: number;
  unpaidAmount: number;
  unpaidEntriesCount: number;
  daysUntilBilling: number;
  isLocked: boolean;
}

export default function ClubsBillingPage() {
  const { toast } = useToast();

  const { data: clubs, isLoading, refetch } = useQuery<ClubBillingStatus[]>({
    queryKey: ["/api/owner/clubs-billing"],
  });

  const unlockMutation = useMutation({
    mutationFn: async (clubId: string) => {
      return apiRequest("POST", `/api/owner/clubs/${clubId}/unlock`);
    },
    onSuccess: () => {
      toast({ title: "Club unlocked", description: "The club has been unlocked successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/clubs-billing"] });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unlock club", variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (clubId: string) => {
      return apiRequest("POST", `/api/owner/clubs/${clubId}/lock`);
    },
    onSuccess: () => {
      toast({ title: "Club locked", description: "The club has been locked." });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/clubs-billing"] });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to lock club", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-clubs-billing">
        <div className="animate-pulse text-muted-foreground">Loading billing data...</div>
      </div>
    );
  }

  const lockedClubs = clubs?.filter(c => c.isLocked) || [];
  const activeClubs = clubs?.filter(c => !c.isLocked) || [];
  const totalUnpaid = clubs?.reduce((sum, c) => sum + c.unpaidAmount, 0) || 0;
  const totalActiveAthletes = clubs?.reduce((sum, c) => sum + c.activeAthleteCount, 0) || 0;

  return (
    <div className="space-y-6" data-testid="clubs-billing-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Club Billing Management</h1>
        <p className="text-muted-foreground">
          Monitor billing status, lock/unlock clubs, and view payment summaries
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-clubs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clubs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clubs">{clubs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {lockedClubs.length} locked
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-athletes">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-athletes">{totalActiveAthletes}</div>
            <p className="text-xs text-muted-foreground">
              Across all clubs
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-unpaid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unpaid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-total-unpaid">
              ${totalUnpaid.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding balance
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-locked-clubs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locked Clubs</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-locked-clubs">
              {lockedClubs.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Past grace period
            </p>
          </CardContent>
        </Card>
      </div>

      {lockedClubs.length > 0 && (
        <Card className="border-destructive" data-testid="card-locked-clubs-list">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Locked Clubs
            </CardTitle>
            <CardDescription>
              These clubs have been locked due to unpaid invoices past the 7-day grace period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lockedClubs.map((club) => (
                <div
                  key={club.id}
                  className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/5"
                  data-testid={`row-locked-club-${club.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-destructive/10 rounded-full">
                      <Lock className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-club-name-${club.id}`}>{club.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Locked: {club.billing_locked_at ? format(new Date(club.billing_locked_at), "MMM d, yyyy") : "N/A"}</span>
                        <span>|</span>
                        <span className="text-destructive font-medium">
                          ${club.unpaidAmount.toFixed(2)} unpaid
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-unlock-${club.id}`}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Unlock
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlock {club.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restore access to the club. They still have ${club.unpaidAmount.toFixed(2)} unpaid.
                            Make sure payment has been received before unlocking.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => unlockMutation.mutate(club.id)}
                            disabled={unlockMutation.isPending}
                          >
                            Unlock Club
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-active-clubs-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Active Clubs
          </CardTitle>
          <CardDescription>
            Clubs with active billing and their next billing dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeClubs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active clubs
            </div>
          ) : (
            <div className="space-y-3">
              {activeClubs.map((club) => (
                <div
                  key={club.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`row-active-club-${club.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-club-name-${club.id}`}>{club.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Bills on day {club.billing_day || 1}
                        </span>
                        <span>|</span>
                        <span>{club.daysUntilBilling} days until billing</span>
                        {club.last_billed_at && (
                          <>
                            <span>|</span>
                            <span>Last billed: {format(new Date(club.last_billed_at), "MMM d")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium" data-testid={`text-athletes-${club.id}`}>
                        {club.activeAthleteCount} athletes
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${(club.activeAthleteCount * 3).toFixed(2)}/mo est.
                      </p>
                    </div>
                    <div className="text-right">
                      {club.unpaidAmount > 0 ? (
                        <>
                          <p className="font-medium text-amber-600 dark:text-amber-400" data-testid={`text-unpaid-${club.id}`}>
                            ${club.unpaidAmount.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">unpaid</p>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Paid up
                        </Badge>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      {club.billing_method ? (
                        <span className="text-muted-foreground">
                          {club.billing_method === "credit_card" ? "Card" : "Bank"}
                          {" "}ending {club.billing_card_last_four || club.billing_bank_last_four}
                        </span>
                      ) : (
                        <Badge variant="destructive">No billing</Badge>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-lock-${club.id}`}
                        >
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Lock {club.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately lock the club and prevent them from using the platform.
                            Use this for clubs with billing issues that need immediate attention.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => lockMutation.mutate(club.id)}
                            disabled={lockMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Lock Club
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
