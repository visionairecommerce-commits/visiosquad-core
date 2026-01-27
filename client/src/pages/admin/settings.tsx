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
import { Copy, Plus, Pencil, Trash2, Building2, FileText, MapPin, Palette, RefreshCw, Check, CreditCard, AlertTriangle, Loader2, Landmark } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Club, Facility } from '@shared/schema';

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
  const [contractUrl, setContractUrl] = useState(club?.contract_pdf_url || '');
  
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
    mutationFn: async (docs: { waiver_content: string; contract_pdf_url?: string }) => {
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
      contract_pdf_url: contractUrl || undefined,
    });
  };

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
              Payment method for platform fees ($1.00/month per athlete, $1.00 per clinic, $0.75 per drop-in)
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
                      This will be used to pay for platform fees: $1.00/month per athlete, $1.00 per clinic, $0.75 per drop-in.
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
            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="contract">Season Contract URL (optional)</Label>
                <Input
                  id="contract"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                  placeholder="https://example.com/contract.pdf"
                  data-testid="input-contract-url"
                />
                <p className="text-xs text-muted-foreground">
                  Upload your contract PDF to a file hosting service and paste the link here
                </p>
                {club?.contract_version && (
                  <Badge variant="secondary">Version {club.contract_version}</Badge>
                )}
              </div>
            </div>
            <Button
              onClick={handleSaveDocuments}
              disabled={updateDocumentsMutation.isPending}
              data-testid="button-save-documents"
            >
              Save Documents
            </Button>
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
