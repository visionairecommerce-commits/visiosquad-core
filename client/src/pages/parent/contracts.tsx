import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAthlete } from '@/contexts/AthleteContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { FileText, DollarSign, Calendar, Check, AlertCircle, ArrowLeft, UserX, CreditCard } from 'lucide-react';

interface ProgramContract {
  id: string;
  program_id: string;
  team_id?: string;
  name: string;
  description?: string;
  monthly_price: number;
  paid_in_full_price?: number;
  initiation_fee?: number;
  sessions_per_week: number;
  contract_document_id?: string;
  is_active: boolean;
}

interface AvailableContractsResponse {
  not_assigned: boolean;
  message?: string;
  contracts: ProgramContract[];
}

interface AthleteContract {
  id: string;
  athlete_id: string;
  program_contract_id: string;
  start_date: string;
  end_date?: string;
  payment_plan: 'monthly' | 'paid_in_full';
  signed_name?: string;
  signed_at?: string;
  status: 'active' | 'cancelled' | 'expired';
  billing_day_of_month?: number;
  billing_status?: string;
  next_billing_date?: string;
}

interface ParentPaymentMethod {
  id: string;
  payment_type: 'card' | 'ach';
  card_last_four?: string;
  card_brand?: string;
  bank_last_four?: string;
  bank_name?: string;
  is_default: boolean;
}

interface Program {
  id: string;
  name: string;
}

export default function ParentContractsPage() {
  const { activeAthlete } = useAthlete();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedContract, setSelectedContract] = useState<ProgramContract | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<'monthly' | 'paid_in_full'>('monthly');
  const [signedName, setSignedName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [billingDay, setBillingDay] = useState<number>(1);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  const { data: contractsResponse, isLoading: loadingContracts } = useQuery<AvailableContractsResponse>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'available-contracts'],
    queryFn: async () => {
      if (!activeAthlete?.id) return { not_assigned: false, contracts: [] };
      const res = await fetch(`/api/athletes/${activeAthlete.id}/available-contracts`, {
        headers: {
          'X-User-Role': 'parent',
          'X-User-Id': localStorage.getItem('userId') || '',
          'X-Club-Id': localStorage.getItem('clubId') || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch contracts');
      return res.json();
    },
    enabled: !!activeAthlete?.id,
  });
  
  const availableContracts = contractsResponse?.contracts || [];
  const isNotAssigned = contractsResponse?.not_assigned || false;
  const notAssignedMessage = contractsResponse?.message || '';

  const { data: currentContract, isLoading: loadingCurrent } = useQuery<AthleteContract | null>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'contract'],
    queryFn: async () => {
      if (!activeAthlete?.id) return null;
      const res = await fetch(`/api/athletes/${activeAthlete.id}/contract`, {
        headers: {
          'X-User-Role': 'parent',
          'X-User-Id': localStorage.getItem('userId') || '',
          'X-Club-Id': localStorage.getItem('clubId') || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch current contract');
      return res.json();
    },
    enabled: !!activeAthlete?.id,
  });

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: paymentMethods = [] } = useQuery<ParentPaymentMethod[]>({
    queryKey: ['/api/parents/payment-methods'],
    queryFn: async () => {
      const res = await fetch('/api/parents/payment-methods', {
        headers: {
          'X-User-Role': 'parent',
          'X-User-Id': localStorage.getItem('userId') || '',
          'X-Club-Id': localStorage.getItem('clubId') || '',
        },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (data: {
      program_contract_id: string;
      payment_plan: string;
      signed_name: string;
      billing_day_of_month?: number;
      payment_method_id?: string;
    }) => {
      return apiRequest('POST', `/api/athletes/${activeAthlete?.id}/enroll-contract`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes', activeAthlete?.id, 'contract'] });
      queryClient.invalidateQueries({ queryKey: ['/api/athletes', activeAthlete?.id, 'available-contracts'] });
      setEnrollDialogOpen(false);
      setSelectedContract(null);
      setPaymentPlan('monthly');
      setSignedName('');
      setAgreedToTerms(false);
      setBillingDay(1);
      setSelectedPaymentMethodId('');
      toast({
        title: 'Contract Signed',
        description: 'Your athlete has been enrolled in the selected contract.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to enroll in contract. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSelectContract = (contract: ProgramContract) => {
    setSelectedContract(contract);
    setPaymentPlan(contract.paid_in_full_price ? 'monthly' : 'monthly');
    const defaultMethod = paymentMethods.find(m => m.is_default);
    setSelectedPaymentMethodId(defaultMethod?.id || '');
    setEnrollDialogOpen(true);
  };

  const handleEnroll = () => {
    if (!selectedContract || !signedName.trim() || !agreedToTerms) {
      toast({
        title: 'Missing Information',
        description: 'Please complete all required fields and agree to the terms.',
        variant: 'destructive',
      });
      return;
    }
    if (paymentPlan === 'monthly' && !selectedPaymentMethodId) {
      toast({
        title: 'Payment Method Required',
        description: 'Please select a payment method for automatic monthly billing.',
        variant: 'destructive',
      });
      return;
    }
    const enrollData: any = {
      program_contract_id: selectedContract.id,
      payment_plan: paymentPlan,
      signed_name: signedName.trim(),
    };
    if (paymentPlan === 'monthly' && selectedPaymentMethodId) {
      enrollData.billing_day_of_month = billingDay;
      enrollData.payment_method_id = selectedPaymentMethodId;
    }
    enrollMutation.mutate(enrollData);
  };

  const formatPaymentMethod = (pm: ParentPaymentMethod) => {
    if (pm.payment_type === 'ach') {
      return `${pm.bank_name || 'Bank'} ending in ${pm.bank_last_four || '****'}`;
    }
    return `${pm.card_brand || 'Card'} ending in ${pm.card_last_four || '****'}`;
  };

  const getProgramName = (programId: string) => {
    return programs.find(p => p.id === programId)?.name || 'Unknown Program';
  };

  const calculateTotalDue = (contract: ProgramContract, plan: 'monthly' | 'paid_in_full') => {
    const basePrice = plan === 'paid_in_full' && contract.paid_in_full_price 
      ? contract.paid_in_full_price 
      : contract.monthly_price;
    const initiation = contract.initiation_fee || 0;
    return { basePrice, initiation, total: basePrice + initiation };
  };

  if (!activeAthlete) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Athlete Selected</AlertTitle>
          <AlertDescription>
            Please select an athlete from the dashboard to view their contracts.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation('/parent/athletes')} data-testid="button-go-to-athletes">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Athletes
        </Button>
      </div>
    );
  }

  if (loadingContracts || loadingCurrent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading contracts...</div>
      </div>
    );
  }

  const currentContractDetails = currentContract && availableContracts.find(c => c.id === currentContract.program_contract_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation('/parent/athletes')} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-contracts-title">
            Contracts for {activeAthlete.first_name}
          </h1>
          <p className="text-muted-foreground">View and enroll in program contracts</p>
        </div>
      </div>

      {currentContract && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20" data-testid="card-current-contract">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Current Active Contract</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentContractDetails?.name || 'Contract'}</p>
                {currentContractDetails && (
                  <p className="text-sm text-muted-foreground">{getProgramName(currentContractDetails.program_id)}</p>
                )}
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {currentContract.payment_plan === 'paid_in_full' ? 'Paid in Full' : 'Monthly'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span>Started: {new Date(currentContract.start_date).toLocaleDateString()}</span>
              {currentContract.signed_name && (
                <span>Signed by: {currentContract.signed_name}</span>
              )}
              {currentContract.billing_day_of_month && currentContract.billing_status === 'active' && (
                <span data-testid="text-billing-schedule">
                  Auto-billed on the {currentContract.billing_day_of_month === 1 ? '1st' : currentContract.billing_day_of_month === 2 ? '2nd' : currentContract.billing_day_of_month === 3 ? '3rd' : `${currentContract.billing_day_of_month}th`} of each month
                </span>
              )}
              {currentContract.next_billing_date && (
                <span data-testid="text-next-billing">
                  Next bill: {new Date(currentContract.next_billing_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Available Contracts</h2>
        {isNotAssigned ? (
          <Card data-testid="card-not-assigned">
            <CardContent className="py-12 text-center">
              <UserX className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Not Yet Assigned</h3>
              <p className="text-muted-foreground" data-testid="text-not-assigned-message">
                {notAssignedMessage || "You have not yet been assigned to a program or team, please contact your club director to have them assign you."}
              </p>
            </CardContent>
          </Card>
        ) : availableContracts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Contracts Available</h3>
              <p className="text-muted-foreground">
                There are no contracts available for {activeAthlete.first_name}'s programs yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableContracts.map((contract) => {
              const isCurrentContract = currentContract?.program_contract_id === contract.id;
              return (
                <Card
                  key={contract.id}
                  className={isCurrentContract ? 'border-green-500/50' : ''}
                  data-testid={`card-available-contract-${contract.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{contract.name}</CardTitle>
                        <CardDescription>{getProgramName(contract.program_id)}</CardDescription>
                      </div>
                      {isCurrentContract && (
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contract.description && (
                      <p className="text-sm text-muted-foreground">{contract.description}</p>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">${contract.monthly_price}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      {contract.paid_in_full_price && (
                        <div className="text-sm text-muted-foreground pl-5">
                          or <span className="font-medium text-foreground">${contract.paid_in_full_price}</span> paid-in-full
                        </div>
                      )}
                      {contract.initiation_fee && (
                        <div className="text-sm text-muted-foreground pl-5">
                          + ${contract.initiation_fee} initiation fee
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span>{contract.sessions_per_week} sessions/week</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    {isCurrentContract ? (
                      <Button variant="outline" disabled className="w-full">
                        Currently Enrolled
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleSelectContract(contract)}
                        className="w-full"
                        data-testid={`button-enroll-${contract.id}`}
                      >
                        Enroll Now
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enroll in Contract</DialogTitle>
            <DialogDescription>
              Review the contract details and sign to enroll {activeAthlete.first_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold">{selectedContract.name}</h3>
                <p className="text-sm text-muted-foreground">{getProgramName(selectedContract.program_id)}</p>
                {selectedContract.description && (
                  <p className="text-sm">{selectedContract.description}</p>
                )}
              </div>

              {selectedContract.paid_in_full_price && (
                <div className="space-y-3">
                  <Label>Select Payment Plan</Label>
                  <RadioGroup value={paymentPlan} onValueChange={(v) => setPaymentPlan(v as 'monthly' | 'paid_in_full')}>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover-elevate">
                      <RadioGroupItem value="monthly" id="monthly" data-testid="radio-monthly" />
                      <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span>Monthly Payments</span>
                          <span className="font-semibold">${selectedContract.monthly_price}/month</span>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover-elevate">
                      <RadioGroupItem value="paid_in_full" id="paid_in_full" data-testid="radio-paid-in-full" />
                      <Label htmlFor="paid_in_full" className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div>
                            <span>Pay in Full</span>
                            <Badge variant="secondary" className="ml-2">Save ${(selectedContract.monthly_price * 12) - (selectedContract.paid_in_full_price || 0)}</Badge>
                          </div>
                          <span className="font-semibold">${selectedContract.paid_in_full_price}</span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {paymentPlan === 'monthly' && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Automatic Monthly Billing</h4>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing_day">What day of the month should we bill you?</Label>
                    <div className="flex items-center gap-2">
                      <select
                        id="billing_day"
                        value={billingDay}
                        onChange={(e) => setBillingDay(parseInt(e.target.value))}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        data-testid="select-billing-day"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>
                            {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">of each month</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    {paymentMethods.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No payment methods on file. Please add one from the Payments page first.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <RadioGroup
                        value={selectedPaymentMethodId}
                        onValueChange={setSelectedPaymentMethodId}
                      >
                        {paymentMethods.map((pm) => (
                          <div key={pm.id} className="flex items-center space-x-2 p-3 border rounded-md hover-elevate">
                            <RadioGroupItem value={pm.id} id={`pm-${pm.id}`} data-testid={`radio-pm-${pm.id}`} />
                            <Label htmlFor={`pm-${pm.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center justify-between gap-2">
                                <span>{formatPaymentMethod(pm)}</span>
                                {pm.is_default && <Badge variant="secondary">Default</Badge>}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{paymentPlan === 'monthly' ? 'Monthly Amount' : 'Amount Due Today'}</h4>
                {(() => {
                  const { basePrice, initiation, total } = calculateTotalDue(selectedContract, paymentPlan);
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>{paymentPlan === 'paid_in_full' ? 'Full Payment' : 'Monthly Payment'}</span>
                        <span>${basePrice}</span>
                      </div>
                      {initiation > 0 && (
                        <div className="flex justify-between">
                          <span>Initiation Fee</span>
                          <span>${initiation}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-1 border-t">
                        <span>Total</span>
                        <span>${total}{paymentPlan === 'monthly' ? '/mo' : ''}</span>
                      </div>
                      {paymentPlan === 'monthly' && (
                        <p className="text-xs text-muted-foreground pt-2">
                          Your card will be automatically charged on the {billingDay === 1 ? '1st' : billingDay === 2 ? '2nd' : billingDay === 3 ? '3rd' : `${billingDay}th`} of each month.
                          Technology and service fees will be included at checkout.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <Label htmlFor="signed_name">Your Signature (Full Legal Name)</Label>
                <Input
                  id="signed_name"
                  placeholder="Type your full legal name"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  data-testid="input-signature"
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  data-testid="checkbox-agree"
                />
                <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                  I agree to the contract terms and authorize automatic billing according to the selected plan.
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={enrollMutation.isPending || !signedName.trim() || !agreedToTerms}
              data-testid="button-confirm-enroll"
            >
              {enrollMutation.isPending ? 'Enrolling...' : 'Sign & Enroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
