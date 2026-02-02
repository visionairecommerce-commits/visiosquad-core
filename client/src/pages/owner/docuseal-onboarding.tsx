import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileSignature, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  Building2,
  Mail,
  Calendar,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DocuSealSetupRequest {
  id: string;
  club_id: string;
  club_name: string;
  requested_by_user_id?: string;
  requested_by_email: string;
  requested_at: string;
  status: 'open' | 'in_progress' | 'completed' | 'rejected';
  notes?: string;
  payload?: {
    program_name?: string;
    team_name?: string;
    template_id?: string;
    contract_name?: string;
  };
}

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

export default function DocuSealOnboardingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DocuSealSetupRequest | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [teamName, setTeamName] = useState("");
  const [newStatus, setNewStatus] = useState<'open' | 'in_progress' | 'completed' | 'rejected'>('open');

  const { data: requests = [], isLoading } = useQuery<DocuSealSetupRequest[]>({
    queryKey: ['/api/owner/docuseal-setup-requests'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes, team_name }: { id: string; status: string; notes?: string; team_name?: string }) => {
      return apiRequest(`/api/owner/docuseal-setup-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes, team_name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/owner/docuseal-setup-requests'] });
      setUpdateDialogOpen(false);
      setSelectedRequest(null);
      toast({
        title: "Request Updated",
        description: "The DocuSeal setup request has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    },
  });

  const handleOpenUpdateDialog = (request: DocuSealSetupRequest, status: 'open' | 'in_progress' | 'completed' | 'rejected') => {
    setSelectedRequest(request);
    setNewStatus(status);
    setNotes(request.notes || "");
    setTeamName("");
    setUpdateDialogOpen(true);
  };

  const handleUpdateRequest = () => {
    if (!selectedRequest) return;
    updateMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      notes: notes || undefined,
      team_name: newStatus === 'completed' ? teamName : undefined,
    });
  };

  const openRequests = requests.filter(r => r.status === 'open');
  const inProgressRequests = requests.filter(r => r.status === 'in_progress');

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6" data-testid="header-docuseal-onboarding">
        <FileSignature className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">DocuSeal Onboarding</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Manage club DocuSeal team setup and onboarding</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-checklist-title">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Onboarding Checklist
            </CardTitle>
            <CardDescription>
              Follow these steps to onboard a new club to DocuSeal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">1</span>
                <div>
                  <p className="font-medium">Go to DocuSeal Console</p>
                  <p className="text-sm text-muted-foreground">Navigate to the DocuSeal admin console</p>
                  <a 
                    href="https://docuseal.com/console" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                    data-testid="link-docuseal-console"
                  >
                    Open DocuSeal Console <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">2</span>
                <div>
                  <p className="font-medium">Create Team</p>
                  <p className="text-sm text-muted-foreground">Create a new Team with the club's name</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">3</span>
                <div>
                  <p className="font-medium">Invite Director</p>
                  <p className="text-sm text-muted-foreground">Invite the club director's email as an Admin to the team</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">4</span>
                <div>
                  <p className="font-medium">Director Creates Templates</p>
                  <p className="text-sm text-muted-foreground">Director logs in and creates contract templates</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">5</span>
                <div>
                  <p className="font-medium">Copy Template IDs</p>
                  <p className="text-sm text-muted-foreground">Director copies Template IDs into VisioSquad contract configurations</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">6</span>
                <div>
                  <p className="font-medium">Test & Confirm</p>
                  <p className="text-sm text-muted-foreground">Verify webhook and signing flow works correctly</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-requests-title">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Setup Requests
              {(openRequests.length + inProgressRequests.length) > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-pending-count">
                  {openRequests.length + inProgressRequests.length} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Clubs waiting for DocuSeal onboarding
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending setup requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div 
                    key={request.id}
                    className="border rounded-lg p-4 hover-elevate"
                    data-testid={`card-request-${request.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium" data-testid={`text-club-name-${request.id}`}>{request.club_name}</span>
                      </div>
                      <Badge className={statusColors[request.status]} data-testid={`badge-status-${request.id}`}>
                        {statusLabels[request.status]}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{request.requested_by_email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(request.requested_at), "MMM d, yyyy h:mm a")}</span>
                      </div>
                      {request.payload?.contract_name && (
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-3 w-3" />
                          <span>Contract: {request.payload.contract_name}</span>
                        </div>
                      )}
                      {request.payload?.template_id && (
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-mono text-xs">Template: {request.payload.template_id}</span>
                        </div>
                      )}
                      {request.notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          {request.notes}
                        </div>
                      )}
                    </div>

                    {request.status !== 'completed' && request.status !== 'rejected' && (
                      <div className="flex gap-2">
                        {request.status === 'open' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleOpenUpdateDialog(request, 'in_progress')}
                            data-testid={`button-in-progress-${request.id}`}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Mark In Progress
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          onClick={() => handleOpenUpdateDialog(request, 'completed')}
                          data-testid={`button-complete-${request.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Completed
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Update Request - {selectedRequest?.club_name}
            </DialogTitle>
            <DialogDescription>
              {newStatus === 'completed' 
                ? "Mark this club as DocuSeal onboarded. This will allow them to use DocuSeal templates."
                : "Update the status of this setup request."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {newStatus === 'completed' && (
              <div className="space-y-2">
                <Label htmlFor="team_name">DocuSeal Team Name (optional)</Label>
                <Input
                  id="team_name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Club Name Team"
                  data-testid="input-team-name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this onboarding..."
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateRequest}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-update"
            >
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {newStatus === 'completed' ? 'Complete Onboarding' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
