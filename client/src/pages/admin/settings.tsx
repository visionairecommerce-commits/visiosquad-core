import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Copy, Plus, Pencil, Trash2, Building2, FileText, MapPin, Palette, RefreshCw, Check, CreditCard, AlertTriangle, Loader2, Landmark, Users, Link, ExternalLink, HelpCircle, Shield, MessageSquare, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Club, Facility, ClubForm, Program, Team } from '@shared/schema';

interface Season {
  id: string;
  club_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  chat_data_deleted: boolean;
  created_at: string;
}

function SeasonsCard() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const { data: seasons = [], isLoading } = useQuery<Season[]>({
    queryKey: ['/api/seasons'],
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; start_date: string; end_date: string }) => {
      return apiRequest('POST', '/api/seasons', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: 'Season created successfully!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Failed to create season', variant: 'destructive' });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; start_date?: string; end_date?: string }) => {
      return apiRequest('PATCH', `/api/seasons/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: 'Season updated successfully!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Failed to update season', variant: 'destructive' });
    },
  });
  
  const activateMutation = useMutation({
    mutationFn: async (seasonId: string) => {
      return apiRequest('POST', `/api/seasons/${seasonId}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: 'Season activated! All chat data will be deleted when this season ends.' });
    },
    onError: () => {
      toast({ title: 'Failed to activate season', variant: 'destructive' });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (seasonId: string) => {
      return apiRequest('DELETE', `/api/seasons/${seasonId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: 'Season deleted successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete season', variant: 'destructive' });
    },
  });
  
  const resetForm = () => {
    setDialogOpen(false);
    setEditingSeason(null);
    setSeasonName('');
    setStartDate('');
    setEndDate('');
  };
  
  const handleEdit = (season: Season) => {
    setEditingSeason(season);
    setSeasonName(season.name);
    setStartDate(season.start_date.split('T')[0]);
    setEndDate(season.end_date.split('T')[0]);
    setDialogOpen(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSeason) {
      updateMutation.mutate({ id: editingSeason.id, name: seasonName, start_date: startDate, end_date: endDate });
    } else {
      createMutation.mutate({ name: seasonName, start_date: startDate, end_date: endDate });
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seasons
          </CardTitle>
          <CardDescription>
            Define club seasons for automatic chat data cleanup
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-season">
              <Plus className="h-4 w-4 mr-1" /> Add Season
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSeason ? 'Edit Season' : 'Create Season'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seasonName">Season Name</Label>
                <Input
                  id="seasonName"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="e.g., Fall 2026"
                  required
                  data-testid="input-season-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    data-testid="input-season-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    data-testid="input-season-end"
                  />
                </div>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All chat messages (except event chats) will be automatically deleted when the season ends to manage storage.
                </AlertDescription>
              </Alert>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-season">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSeason ? 'Update Season' : 'Create Season'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading seasons...
          </div>
        ) : seasons.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No seasons defined yet. Create one to enable automatic chat cleanup.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {seasons.map((season) => (
              <div key={season.id} className="flex items-center justify-between p-3 rounded-md border" data-testid={`season-item-${season.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{season.name}</p>
                    {season.is_active && <Badge variant="default">Active</Badge>}
                    {season.chat_data_deleted && <Badge variant="secondary">Cleaned</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(season.start_date)} — {formatDate(season.end_date)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!season.is_active && !season.chat_data_deleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateMutation.mutate(season.id)}
                      disabled={activateMutation.isPending}
                      data-testid={`button-activate-season-${season.id}`}
                    >
                      Set Active
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(season)} data-testid={`button-edit-season-${season.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(season.id)} disabled={deleteMutation.isPending || season.is_active} data-testid={`button-delete-season-${season.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommunicationSettingsCard() {
  const { toast } = useToast();
  
  interface CommunicationSettings {
    include_director_in_chats: boolean;
  }
  
  const { data: settings, isLoading } = useQuery<CommunicationSettings>({
    queryKey: ['/api/communication-settings'],
  });
  
  const updateMutation = useMutation({
    mutationFn: async (newSettings: CommunicationSettings) => {
      return apiRequest('PATCH', '/api/communication-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication-settings'] });
      toast({ title: 'Communication settings updated!' });
    },
    onError: () => {
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    },
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication Settings
        </CardTitle>
        <CardDescription>
          Configure SafeSport compliant messaging options for your club
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Include Director in All Chats
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically add the club director to all new chat conversations for oversight
              </p>
            </div>
            <Switch
              checked={settings?.include_director_in_chats ?? false}
              onCheckedChange={(checked) => 
                updateMutation.mutate({ include_director_in_chats: checked })
              }
              disabled={updateMutation.isPending}
              data-testid="switch-include-director"
            />
          </div>
        )}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            SafeSport Compliance: Coach-athlete chats automatically include the athlete's parent. 
            Private 1-on-1 messaging between adults and minors is blocked.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

interface BillingStatusResponse {
  billingDay: number;
  lastBilledAt: string | null;
  lastBilledPeriodStart: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  activeAthleteCount: number;
  estimatedMonthlyFee: number;
  unpaidAmount: number;
  nextBillingDate: string;
}

function BillingDayCard() {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<string>('1');
  
  const { data: billingStatus, isLoading } = useQuery<BillingStatusResponse>({
    queryKey: ['/api/clubs/billing-status'],
  });
  
  const updateBillingDayMutation = useMutation({
    mutationFn: async (billingDay: number) => {
      return apiRequest('PATCH', '/api/clubs/billing-day', { billing_day: billingDay });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clubs/billing-status'] });
      toast({ title: 'Billing day updated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to update billing day', variant: 'destructive' });
    },
  });
  
  const handleSaveBillingDay = () => {
    const dayNum = parseInt(selectedDay, 10);
    if (dayNum >= 1 && dayNum <= 28) {
      updateBillingDayMutation.mutate(dayNum);
    }
  };
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Platform Billing Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading billing status...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Platform Billing Schedule
        </CardTitle>
        <CardDescription>
          Choose when your club gets billed for platform fees ($3/player/month). Bills are generated on this day each month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {billingStatus?.isLocked && (
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              Your club is currently locked due to unpaid platform fees. Please contact support to resolve this.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Active Athletes</p>
            <p className="text-2xl font-bold">{billingStatus?.activeAthleteCount || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Est. Monthly Fee</p>
            <p className="text-2xl font-bold">${billingStatus?.estimatedMonthlyFee?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unpaid Balance</p>
            <p className={`text-2xl font-bold ${(billingStatus?.unpaidAmount || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              ${billingStatus?.unpaidAmount?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Next Billing Date</p>
            <p className="text-lg font-medium">{formatDate(billingStatus?.nextBillingDate || null)}</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="billingDay">Billing Day of Month</Label>
          <div className="flex gap-2">
            <Select
              value={selectedDay || String(billingStatus?.billingDay || 1)}
              onValueChange={setSelectedDay}
            >
              <SelectTrigger className="w-24" data-testid="select-billing-day">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSaveBillingDay}
              disabled={updateBillingDayMutation.isPending}
              data-testid="button-save-billing-day"
            >
              {updateBillingDayMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bills are generated on this day each month. Choose 1-28 to avoid issues with months that have fewer days.
          </p>
        </div>
        
        {billingStatus?.lastBilledAt && (
          <div className="text-sm text-muted-foreground">
            Last billed: {formatDate(billingStatus.lastBilledAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { club, setClub } = useAuth();
  const { toast } = useToast();
  const [codeCopied, setCodeCopied] = useState(false);
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityName, setFacilityName] = useState('');
  const [facilityDescription, setFacilityDescription] = useState('');

  const [clubName, setClubName] = useState(club?.name || '');
  const [clubAddress, setClubAddress] = useState(club?.address || '');
  const [clubLogoUrl, setClubLogoUrl] = useState(club?.logo_url || '');
  const [waiverContent, setWaiverContent] = useState(club?.waiver_content || '');
  const [contractUrl, setContractUrl] = useState(club?.contract_url || '');
  const [contractInstructions, setContractInstructions] = useState(club?.contract_instructions || '');
  
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<ClubForm | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formProgramId, setFormProgramId] = useState<string | null>(null);
  const [formTeamId, setFormTeamId] = useState<string | null>(null);
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingType, setBillingType] = useState<'card' | 'bank'>('card');

  // Initialize billing type from current billing method when dialog opens
  const handleOpenBillingDialog = (open: boolean) => {
    if (open && billingStatus?.billing_method) {
      setBillingType(billingStatus.billing_method);
    }
    setBillingDialogOpen(open);
  };
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
  });

  const { data: clubForms = [], isLoading: formsLoading } = useQuery<ClubForm[]>({
    queryKey: ['/api/club-forms'],
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  interface Coach {
    id: string;
    email: string;
    full_name: string;
    can_bill: boolean;
  }

  const { data: coaches = [], isLoading: coachesLoading } = useQuery<Coach[]>({
    queryKey: ['/api/coaches'],
  });

  interface BillingStatus {
    has_billing_method: boolean;
    billing_method: 'card' | 'bank' | null;
    card_last_four: string | null;
    bank_last_four: string | null;
  }

  const { data: billingStatus, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ['/api/clubs', club?.id, 'billing'],
    enabled: !!club?.id,
  });

  const addBillingCardMutation = useMutation({
    mutationFn: async (cardData: { card_number: string; expiry: string; cvv: string }) => {
      const response = await apiRequest('POST', `/api/clubs/${club?.id}/billing/card`, cardData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clubs', club?.id, 'billing'] });
      setBillingDialogOpen(false);
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      toast({ title: 'Billing card added successfully!' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add card', 
        description: error?.message || 'Please check the card details and try again',
        variant: 'destructive' 
      });
    },
  });

  const handleAddBillingCard = () => {
    if (!cardNumber || !cardExpiry || !cardCvv) {
      toast({ title: 'Please fill in all card fields', variant: 'destructive' });
      return;
    }
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    addBillingCardMutation.mutate({
      card_number: cleanCardNumber,
      expiry: cardExpiry.replace('/', ''),
      cvv: cardCvv,
    });
  };

  const addBillingBankMutation = useMutation({
    mutationFn: async (bankData: { routing_number: string; account_number: string; account_type: 'checking' | 'savings' }) => {
      const response = await apiRequest('POST', `/api/clubs/${club?.id}/billing/bank`, bankData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clubs', club?.id, 'billing'] });
      setBillingDialogOpen(false);
      setRoutingNumber('');
      setAccountNumber('');
      setAccountType('checking');
      toast({ title: 'Bank account added successfully!' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add bank account', 
        description: error?.message || 'Please check the account details and try again',
        variant: 'destructive' 
      });
    },
  });

  const handleAddBillingBank = () => {
    if (!routingNumber || !accountNumber) {
      toast({ title: 'Please fill in all bank account fields', variant: 'destructive' });
      return;
    }
    addBillingBankMutation.mutate({
      routing_number: routingNumber,
      account_number: accountNumber,
      account_type: accountType,
    });
  };

  const copyCodeMutation = useMutation({
    mutationFn: async () => {
      if (club?.join_code) {
        await navigator.clipboard.writeText(club.join_code);
      }
    },
    onSuccess: () => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({ title: 'Club code copied!' });
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clubs/${club?.id}/regenerate-code`);
      return response.json();
    },
    onSuccess: (data: Club) => {
      setClub(data);
      toast({ title: 'Club code regenerated!' });
    },
    onError: () => {
      toast({ title: 'Failed to regenerate code', variant: 'destructive' });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { name?: string; address?: string; logo_url?: string }) => {
      const response = await apiRequest('PUT', `/api/clubs/${club?.id}/settings`, settings);
      return response.json();
    },
    onSuccess: (data: Club) => {
      setClub(data);
      toast({ title: 'Settings saved!' });
    },
    onError: () => {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    },
  });

  const updateDocumentsMutation = useMutation({
    mutationFn: async (docs: { waiver_content: string }) => {
      const response = await apiRequest('PUT', `/api/clubs/${club?.id}/documents`, docs);
      return response.json();
    },
    onSuccess: (data: Club) => {
      setClub(data);
      toast({ title: 'Documents saved!' });
    },
    onError: () => {
      toast({ title: 'Failed to save documents', variant: 'destructive' });
    },
  });

  const updateContractSettingsMutation = useMutation({
    mutationFn: async (settings: { contract_url?: string; contract_instructions?: string }) => {
      const response = await apiRequest('PATCH', '/api/club/contract-settings', settings);
      return response.json();
    },
    onSuccess: (data: Club) => {
      setClub(data);
      toast({ title: 'Contract settings saved!' });
    },
    onError: () => {
      toast({ title: 'Failed to save contract settings', variant: 'destructive' });
    },
  });

  const handleSaveContractSettings = () => {
    updateContractSettingsMutation.mutate({
      contract_url: contractUrl || undefined,
      contract_instructions: contractInstructions || undefined,
    });
  };

  const createFormMutation = useMutation({
    mutationFn: async (form: { name: string; url: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/club-forms', form);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/club-forms'] });
      setFormDialogOpen(false);
      resetFormFields();
      toast({ title: 'Form link added!' });
    },
    onError: () => {
      toast({ title: 'Failed to add form link', variant: 'destructive' });
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; url?: string; description?: string } }) => {
      const response = await apiRequest('PATCH', `/api/club-forms/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/club-forms'] });
      setFormDialogOpen(false);
      setEditingForm(null);
      resetFormFields();
      toast({ title: 'Form link updated!' });
    },
    onError: () => {
      toast({ title: 'Failed to update form link', variant: 'destructive' });
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/club-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/club-forms'] });
      toast({ title: 'Form link deleted!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete form link', variant: 'destructive' });
    },
  });

  const resetFormFields = () => {
    setFormName('');
    setFormUrl('');
    setFormDescription('');
    setFormProgramId(null);
    setFormTeamId(null);
  };

  const createFacilityMutation = useMutation({
    mutationFn: async (facility: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/facilities', facility);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      setFacilityDialogOpen(false);
      resetFacilityForm();
      toast({ title: 'Facility created!' });
    },
    onError: () => {
      toast({ title: 'Failed to create facility', variant: 'destructive' });
    },
  });

  const updateFacilityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const response = await apiRequest('PUT', `/api/facilities/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      setFacilityDialogOpen(false);
      setEditingFacility(null);
      resetFacilityForm();
      toast({ title: 'Facility updated!' });
    },
    onError: () => {
      toast({ title: 'Failed to update facility', variant: 'destructive' });
    },
  });

  const deleteFacilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/facilities/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      toast({ title: 'Facility deleted!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete facility', variant: 'destructive' });
    },
  });

  const updateCoachBillingMutation = useMutation({
    mutationFn: async ({ coachId, canBill }: { coachId: string; canBill: boolean }) => {
      const response = await apiRequest('PATCH', `/api/coaches/${coachId}/billing`, { 
        can_bill: canBill 
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaches'] });
      toast({ 
        title: data?.can_bill 
          ? `${data.full_name} can now bill athletes` 
          : `${data.full_name} billing access removed` 
      });
    },
    onError: () => {
      toast({ title: 'Failed to update permission', variant: 'destructive' });
    },
  });

  const resetFacilityForm = () => {
    setFacilityName('');
    setFacilityDescription('');
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      name: clubName,
      address: clubAddress,
      logo_url: clubLogoUrl,
    });
  };

  const handleSaveDocuments = () => {
    if (!waiverContent || waiverContent.length < 10) {
      toast({ title: 'Waiver content must be at least 10 characters', variant: 'destructive' });
      return;
    }
    updateDocumentsMutation.mutate({
      waiver_content: waiverContent,
    });
  };

  const handleFormSubmit = () => {
    if (!formName.trim()) {
      toast({ title: 'Form name is required', variant: 'destructive' });
      return;
    }
    if (!formUrl.trim()) {
      toast({ title: 'Form URL is required', variant: 'destructive' });
      return;
    }
    if (editingForm) {
      updateFormMutation.mutate({
        id: editingForm.id,
        data: { 
          name: formName, 
          url: formUrl, 
          description: formDescription,
          program_id: formProgramId,
          team_id: formTeamId,
        },
      });
    } else {
      createFormMutation.mutate({
        name: formName,
        url: formUrl,
        description: formDescription,
        program_id: formProgramId,
        team_id: formTeamId,
      });
    }
  };

  const handleEditForm = (form: ClubForm) => {
    setEditingForm(form);
    setFormName(form.name);
    setFormUrl(form.url);
    setFormDescription(form.description || '');
    setFormProgramId(form.program_id || null);
    setFormTeamId(form.team_id || null);
    setFormDialogOpen(true);
  };
  
  // Get teams filtered by selected program
  const filteredTeams = formProgramId 
    ? teams.filter(t => t.program_id === formProgramId)
    : teams;

  const handleFacilitySubmit = () => {
    if (!facilityName.trim()) {
      toast({ title: 'Facility name is required', variant: 'destructive' });
      return;
    }
    if (editingFacility) {
      updateFacilityMutation.mutate({
        id: editingFacility.id,
        data: { name: facilityName, description: facilityDescription },
      });
    } else {
      createFacilityMutation.mutate({
        name: facilityName,
        description: facilityDescription,
      });
    }
  };

  const handleEditFacility = (facility: Facility) => {
    setEditingFacility(facility);
    setFacilityName(facility.name);
    setFacilityDescription(facility.description || '');
    setFacilityDialogOpen(true);
  };

  const joinUrl = `${window.location.origin}/join?code=${club?.join_code}`;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Club Settings</h1>
        <p className="text-muted-foreground">Manage your club's configuration, documents, and facilities</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Club Join Code
            </CardTitle>
            <CardDescription>
              Share this code with parents and coaches to join your club
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold tracking-widest font-mono bg-muted px-4 py-2 rounded-md" data-testid="text-club-code">
                {club?.join_code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyCodeMutation.mutate()}
                data-testid="button-copy-code"
              >
                {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Join Link</Label>
              <div className="flex gap-2">
                <Input value={joinUrl} readOnly className="text-sm" data-testid="input-join-url" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    toast({ title: 'Link copied!' });
                  }}
                  data-testid="button-copy-link"
                >
                  Copy
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerateCodeMutation.mutate()}
              disabled={regenerateCodeMutation.isPending}
              className="text-muted-foreground"
              data-testid="button-regenerate-code"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Code
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Club Identity
            </CardTitle>
            <CardDescription>
              Your club's branding and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clubName">Club Name</Label>
              <Input
                id="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Your Club Name"
                data-testid="input-club-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={clubAddress}
                onChange={(e) => setClubAddress(e.target.value)}
                placeholder="123 Main St, City, State"
                data-testid="input-club-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={clubLogoUrl}
                onChange={(e) => setClubLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                data-testid="input-logo-url"
              />
            </div>
            {clubLogoUrl && (
              <div className="flex justify-center p-2 bg-muted rounded-md">
                <img src={clubLogoUrl} alt="Club logo preview" className="h-16 object-contain" />
              </div>
            )}
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              Save Identity
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing
            </CardTitle>
            <CardDescription>
              Payment method for platform fees ($2.00/month per athlete, $1.00 per player per event, $0.75 per drop-in)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading billing status...
              </div>
            ) : billingStatus?.has_billing_method ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
                  {billingStatus.billing_method === 'card' ? (
                    <>
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Card ending in {billingStatus.card_last_four}</p>
                        <p className="text-sm text-muted-foreground">Credit card is active</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Bank account ending in {billingStatus.bank_last_four}</p>
                        <p className="text-sm text-muted-foreground">Bank account is active</p>
                      </div>
                    </>
                  )}
                </div>
                <Dialog open={billingDialogOpen} onOpenChange={handleOpenBillingDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-update-billing">
                      Update Payment Method
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Update Payment Method</DialogTitle>
                    </DialogHeader>
                    <Tabs value={billingType} onValueChange={(v) => setBillingType(v as 'card' | 'bank')}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="card" data-testid="tab-card">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Credit Card
                        </TabsTrigger>
                        <TabsTrigger value="bank" data-testid="tab-bank">
                          <Landmark className="h-4 w-4 mr-2" />
                          Bank Account
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="card" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardNumber">Card Number</Label>
                          <Input
                            id="cardNumber"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            data-testid="input-card-number"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cardExpiry">Expiry (MMYY)</Label>
                            <Input
                              id="cardExpiry"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="1225"
                              maxLength={4}
                              data-testid="input-card-expiry"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cardCvv">CVV</Label>
                            <Input
                              id="cardCvv"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              placeholder="123"
                              maxLength={4}
                              type="password"
                              data-testid="input-card-cvv"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleAddBillingCard}
                          disabled={addBillingCardMutation.isPending}
                          className="w-full"
                          data-testid="button-submit-card"
                        >
                          {addBillingCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Card
                        </Button>
                      </TabsContent>
                      <TabsContent value="bank" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="routingNumber">Routing Number</Label>
                          <Input
                            id="routingNumber"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value)}
                            placeholder="123456789"
                            maxLength={9}
                            data-testid="input-routing-number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="1234567890"
                            data-testid="input-account-number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountType">Account Type</Label>
                          <Select value={accountType} onValueChange={(v) => setAccountType(v as 'checking' | 'savings')}>
                            <SelectTrigger data-testid="select-account-type">
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checking">Checking</SelectItem>
                              <SelectItem value="savings">Savings</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAddBillingBank}
                          disabled={addBillingBankMutation.isPending}
                          className="w-full"
                          data-testid="button-submit-bank"
                        >
                          {addBillingBankMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Bank Account
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You must add a payment method before you can charge clients. Platform fees will be billed monthly.
                  </AlertDescription>
                </Alert>
                <Dialog open={billingDialogOpen} onOpenChange={handleOpenBillingDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-billing">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Payment Method</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      This will be used to pay for platform fees: $2.00/month per athlete, $1.00 per player per event, $0.75 per drop-in.
                    </p>
                    <Tabs value={billingType} onValueChange={(v) => setBillingType(v as 'card' | 'bank')}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="card" data-testid="tab-card-new">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Credit Card
                        </TabsTrigger>
                        <TabsTrigger value="bank" data-testid="tab-bank-new">
                          <Landmark className="h-4 w-4 mr-2" />
                          Bank Account
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="card" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardNumberNew">Card Number</Label>
                          <Input
                            id="cardNumberNew"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            data-testid="input-card-number-new"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cardExpiryNew">Expiry (MMYY)</Label>
                            <Input
                              id="cardExpiryNew"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="1225"
                              maxLength={4}
                              data-testid="input-card-expiry-new"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cardCvvNew">CVV</Label>
                            <Input
                              id="cardCvvNew"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              placeholder="123"
                              maxLength={4}
                              type="password"
                              data-testid="input-card-cvv-new"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleAddBillingCard}
                          disabled={addBillingCardMutation.isPending}
                          className="w-full"
                          data-testid="button-submit-card-new"
                        >
                          {addBillingCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Card
                        </Button>
                      </TabsContent>
                      <TabsContent value="bank" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="routingNumberNew">Routing Number</Label>
                          <Input
                            id="routingNumberNew"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value)}
                            placeholder="123456789"
                            maxLength={9}
                            data-testid="input-routing-number-new"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountNumberNew">Account Number</Label>
                          <Input
                            id="accountNumberNew"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="1234567890"
                            data-testid="input-account-number-new"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountTypeNew">Account Type</Label>
                          <Select value={accountType} onValueChange={(v) => setAccountType(v as 'checking' | 'savings')}>
                            <SelectTrigger data-testid="select-account-type-new">
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="checking">Checking</SelectItem>
                              <SelectItem value="savings">Savings</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAddBillingBank}
                          disabled={addBillingBankMutation.isPending}
                          className="w-full"
                          data-testid="button-submit-bank-new"
                        >
                          {addBillingBankMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Bank Account
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        <BillingDayCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Coach Billing Permissions
            </CardTitle>
            <CardDescription>
              Choose which coaches can process payments for event registrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coachesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading coaches...
              </div>
            ) : coaches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coaches in your club yet.</p>
            ) : (
              <div className="space-y-3">
                {coaches.map((coach) => (
                  <div 
                    key={coach.id} 
                    className="flex items-center justify-between rounded-md border p-4"
                  >
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">
                        {coach.full_name}
                      </Label>
                      <p className="text-sm text-muted-foreground">{coach.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {coach.can_bill ? 'Can bill' : 'Cannot bill'}
                      </span>
                      <Switch
                        checked={coach.can_bill}
                        onCheckedChange={(checked) => 
                          updateCoachBillingMutation.mutate({ coachId: coach.id, canBill: checked })
                        }
                        disabled={updateCoachBillingMutation.isPending}
                        data-testid={`switch-coach-billing-${coach.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <CommunicationSettingsCard />

        <SeasonsCard />

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Vault
            </CardTitle>
            <CardDescription>
              Legal documents that parents must sign before joining programs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waiver">Master Club Waiver</Label>
              <Textarea
                id="waiver"
                value={waiverContent}
                onChange={(e) => setWaiverContent(e.target.value)}
                placeholder="Enter your club's waiver text..."
                className="min-h-[150px]"
                data-testid="textarea-waiver"
              />
              {club?.waiver_version && (
                <Badge variant="secondary">Version {club.waiver_version}</Badge>
              )}
            </div>
            <Button
              onClick={handleSaveDocuments}
              disabled={updateDocumentsMutation.isPending}
              data-testid="button-save-documents"
            >
              Save Waiver
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Contract Compliance
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>To collect digital signatures for free, we recommend using PandaDoc (Free eSign plan), SignWell, or Dropbox Sign. Upload your PDF there, create a "Shareable Link," and paste it here.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Manage contract signing links and track compliance for all parents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contractUrl" className="flex items-center gap-2">
                External Contract Link
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>To collect digital signatures for free, we recommend using PandaDoc (Free eSign plan), SignWell, or Dropbox Sign. Upload your PDF there, create a "Shareable Link," and paste it here.</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="contractUrl"
                type="url"
                value={contractUrl}
                onChange={(e) => setContractUrl(e.target.value)}
                placeholder="https://app.pandadoc.com/..."
                data-testid="input-contract-url"
              />
              <p className="text-sm text-muted-foreground">
                Parents will be directed to this link to sign your club contract digitally.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractInstructions">Additional Instructions (optional)</Label>
              <Textarea
                id="contractInstructions"
                value={contractInstructions}
                onChange={(e) => setContractInstructions(e.target.value)}
                placeholder="Any special instructions for parents signing the contract..."
                data-testid="textarea-contract-instructions"
              />
            </div>
            <Button
              onClick={handleSaveContractSettings}
              disabled={updateContractSettingsMutation.isPending}
              data-testid="button-save-contract-settings"
            >
              {updateContractSettingsMutation.isPending ? 'Saving...' : 'Save Contract Settings'}
            </Button>
            {club?.contract_url && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Contract link is configured. Parents can sign digitally using the link above.
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between rounded-md border p-4 opacity-50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">
                      Automated Contract Sync
                    </Label>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync contract signatures from supported e-sign platforms
                  </p>
                </div>
                <Switch
                  checked={false}
                  disabled={true}
                  data-testid="switch-automated-sync"
                />
              </div>
              <Alert className="mt-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  Suggestion: Use DocuSeal for your manual contracts now to make the transition to our Automated Sync seamless in the future.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Forms & Links
              </CardTitle>
              <CardDescription>
                Google Forms and other links for coaches and families to use during the season
              </CardDescription>
            </div>
            <Dialog open={formDialogOpen} onOpenChange={(open) => {
              setFormDialogOpen(open);
              if (!open) {
                setEditingForm(null);
                resetFormFields();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-form">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Form Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingForm ? 'Edit Form Link' : 'Add Form Link'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="formName">Name</Label>
                    <Input
                      id="formName"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Equipment Request Form"
                      data-testid="input-form-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formUrl">URL</Label>
                    <Input
                      id="formUrl"
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://forms.google.com/..."
                      data-testid="input-form-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formDesc">Description (optional)</Label>
                    <Textarea
                      id="formDesc"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="What is this form for..."
                      data-testid="textarea-form-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formProgram">Assign to Program (optional)</Label>
                    <Select 
                      value={formProgramId || 'all'} 
                      onValueChange={(v) => {
                        setFormProgramId(v === 'all' ? null : v);
                        setFormTeamId(null); // Reset team when program changes
                      }}
                    >
                      <SelectTrigger data-testid="select-form-program">
                        <SelectValue placeholder="All Programs (visible to everyone)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs (visible to everyone)</SelectItem>
                        {programs.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only athletes in the selected program will see this form
                    </p>
                  </div>
                  {formProgramId && filteredTeams.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="formTeam">Assign to Team (optional)</Label>
                      <Select 
                        value={formTeamId || 'all-teams'} 
                        onValueChange={(v) => setFormTeamId(v === 'all-teams' ? null : v)}
                      >
                        <SelectTrigger data-testid="select-form-team">
                          <SelectValue placeholder="All Teams in Program" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all-teams">All Teams in Program</SelectItem>
                          {filteredTeams.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Only athletes on the selected team will see this form
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={handleFormSubmit}
                    disabled={createFormMutation.isPending || updateFormMutation.isPending}
                    className="w-full"
                    data-testid="button-save-form"
                  >
                    {(createFormMutation.isPending || updateFormMutation.isPending) ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {formsLoading ? (
              <p className="text-muted-foreground">Loading forms...</p>
            ) : clubForms.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No form links added yet. Click "Add Form Link" to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {clubForms.filter(f => f.is_active).map((form) => (
                  <div
                    key={form.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                    data-testid={`form-card-${form.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{form.name}</p>
                        <a
                          href={form.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          data-testid={`link-form-${form.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {form.program_id && (
                          <Badge variant="secondary" className="text-xs">
                            {programs.find(p => p.id === form.program_id)?.name || 'Program'}
                          </Badge>
                        )}
                        {form.team_id && (
                          <Badge variant="outline" className="text-xs">
                            {teams.find(t => t.id === form.team_id)?.name || 'Team'}
                          </Badge>
                        )}
                        {!form.program_id && !form.team_id && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            All Athletes
                          </Badge>
                        )}
                      </div>
                      {form.description && (
                        <p className="text-sm text-muted-foreground truncate">{form.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditForm(form)}
                        data-testid={`button-edit-form-${form.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFormMutation.mutate(form.id)}
                        data-testid={`button-delete-form-${form.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Facilities & Locations
              </CardTitle>
              <CardDescription>
                Manage locations for scheduling sessions with conflict detection
              </CardDescription>
            </div>
            <Dialog open={facilityDialogOpen} onOpenChange={(open) => {
              setFacilityDialogOpen(open);
              if (!open) {
                setEditingFacility(null);
                resetFacilityForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-facility">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Facility
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFacility ? 'Edit Facility' : 'Add Facility'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="facilityName">Name</Label>
                    <Input
                      id="facilityName"
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      placeholder="Main Gym, Field A, Court 1..."
                      data-testid="input-facility-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facilityDesc">Description (optional)</Label>
                    <Textarea
                      id="facilityDesc"
                      value={facilityDescription}
                      onChange={(e) => setFacilityDescription(e.target.value)}
                      placeholder="Additional details about this facility..."
                      data-testid="textarea-facility-description"
                    />
                  </div>
                  <Button
                    onClick={handleFacilitySubmit}
                    disabled={createFacilityMutation.isPending || updateFacilityMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-facility"
                  >
                    {editingFacility ? 'Update Facility' : 'Create Facility'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {facilitiesLoading ? (
              <p className="text-muted-foreground">Loading facilities...</p>
            ) : facilities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No facilities yet</p>
                <p className="text-sm">Add facilities to enable location-based scheduling</p>
              </div>
            ) : (
              <div className="space-y-2">
                {facilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                    data-testid={`facility-item-${facility.id}`}
                  >
                    <div>
                      <p className="font-medium">{facility.name}</p>
                      {facility.description && (
                        <p className="text-sm text-muted-foreground">{facility.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditFacility(facility)}
                        data-testid={`button-edit-facility-${facility.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFacilityMutation.mutate(facility.id)}
                        disabled={deleteFacilityMutation.isPending}
                        data-testid={`button-delete-facility-${facility.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
