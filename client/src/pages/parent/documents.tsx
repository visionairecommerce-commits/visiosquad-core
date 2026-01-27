import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  CheckCircle,
  Clock,
  ExternalLink,
  PenLine,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';

interface ClubSignature {
  id: string;
  document_type: 'waiver' | 'contract';
  signed_name: string;
  signed_at: string;
  document_version: number;
}

export default function ParentDocumentsPage() {
  const { user, club, signDocument } = useAuth();
  const { toast } = useToast();
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [agreedToContract, setAgreedToContract] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState('');
  const [contractSignature, setContractSignature] = useState('');
  const [signingWaiver, setSigningWaiver] = useState(false);
  const [signingContract, setSigningContract] = useState(false);

  const { data: signatures = [], isLoading, refetch } = useQuery<ClubSignature[]>({
    queryKey: ['/api/documents/signatures'],
  });

  const waiverSigned = signatures.find(s => s.document_type === 'waiver');
  const contractSigned = signatures.find(s => s.document_type === 'contract');

  const handleSignWaiver = async () => {
    if (!waiverSignature.trim()) {
      toast({ title: 'Please type your full legal name', variant: 'destructive' });
      return;
    }
    if (!agreedToWaiver) {
      toast({ title: 'You must agree to the waiver terms', variant: 'destructive' });
      return;
    }

    setSigningWaiver(true);
    const result = await signDocument('waiver', waiverSignature.trim());
    setSigningWaiver(false);

    if (result.success) {
      toast({ title: 'Waiver signed successfully!' });
      setWaiverSignature('');
      setAgreedToWaiver(false);
      refetch();
    } else {
      toast({ title: 'Failed to sign waiver', variant: 'destructive' });
    }
  };

  const handleSignContract = async () => {
    if (!contractSignature.trim()) {
      toast({ title: 'Please type your full legal name', variant: 'destructive' });
      return;
    }
    if (!agreedToContract) {
      toast({ title: 'You must agree to the contract terms', variant: 'destructive' });
      return;
    }

    setSigningContract(true);
    const result = await signDocument('contract', contractSignature.trim());
    setSigningContract(false);

    if (result.success) {
      toast({ title: 'Contract signed successfully!' });
      setContractSignature('');
      setAgreedToContract(false);
      refetch();
    } else {
      toast({ title: 'Failed to sign contract', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading documents...</div>
      </div>
    );
  }

  const hasWaiver = !!club?.waiver_content;
  const hasContract = !!club?.contract_pdf_url;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Review and sign required club documents</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Club Waiver</CardTitle>
              </div>
              {waiverSigned ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : hasWaiver ? (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              ) : (
                <Badge variant="secondary">Not Required</Badge>
              )}
            </div>
            <CardDescription>
              {hasWaiver
                ? 'Liability waiver and participation agreement'
                : 'No waiver document has been configured by the club'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {waiverSigned ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Signed by:</span>
                    <span>{waiverSigned.signed_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(waiverSigned.signed_at), 'MMMM d, yyyy \'at\' h:mm a')}
                    </span>
                  </div>
                </div>
                {hasWaiver && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Waiver Content</Label>
                    <ScrollArea className="h-32 rounded-md border p-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {club?.waiver_content}
                      </p>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : hasWaiver ? (
              <div className="space-y-4">
                <ScrollArea className="h-40 rounded-md border p-3 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{club?.waiver_content}</p>
                </ScrollArea>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="waiver-agree"
                    checked={agreedToWaiver}
                    onCheckedChange={(checked) => setAgreedToWaiver(checked === true)}
                    data-testid="checkbox-waiver-agree"
                  />
                  <Label htmlFor="waiver-agree" className="text-sm leading-tight cursor-pointer">
                    I have read and agree to the terms of this waiver
                  </Label>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="waiver-signature">Type your full legal name to sign</Label>
                  <Input
                    id="waiver-signature"
                    placeholder="Your full legal name"
                    value={waiverSignature}
                    onChange={(e) => setWaiverSignature(e.target.value)}
                    data-testid="input-waiver-signature"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSignWaiver}
                  disabled={signingWaiver || !agreedToWaiver || !waiverSignature.trim()}
                  data-testid="button-sign-waiver"
                >
                  {signingWaiver ? (
                    'Signing...'
                  ) : (
                    <>
                      <PenLine className="h-4 w-4 mr-2" />
                      Sign Waiver
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The club has not yet set up a waiver document.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Athlete Contract</CardTitle>
              </div>
              {contractSigned ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : hasContract ? (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              ) : (
                <Badge variant="secondary">Not Required</Badge>
              )}
            </div>
            <CardDescription>
              {hasContract
                ? 'Athlete participation contract and terms'
                : 'No contract document has been configured by the club'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contractSigned ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Signed by:</span>
                    <span>{contractSigned.signed_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(contractSigned.signed_at), 'MMMM d, yyyy \'at\' h:mm a')}
                    </span>
                  </div>
                </div>
                {hasContract && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={club?.contract_pdf_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Contract PDF
                    </a>
                  </Button>
                )}
              </div>
            ) : hasContract ? (
              <div className="space-y-4">
                <Button variant="outline" asChild className="w-full">
                  <a
                    href={club?.contract_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-view-contract"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Contract PDF
                  </a>
                </Button>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="contract-agree"
                    checked={agreedToContract}
                    onCheckedChange={(checked) => setAgreedToContract(checked === true)}
                    data-testid="checkbox-contract-agree"
                  />
                  <Label htmlFor="contract-agree" className="text-sm leading-tight cursor-pointer">
                    I have read and agree to the terms of this contract
                  </Label>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="contract-signature">Type your full legal name to sign</Label>
                  <Input
                    id="contract-signature"
                    placeholder="Your full legal name"
                    value={contractSignature}
                    onChange={(e) => setContractSignature(e.target.value)}
                    data-testid="input-contract-signature"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSignContract}
                  disabled={signingContract || !agreedToContract || !contractSignature.trim()}
                  data-testid="button-sign-contract"
                >
                  {signingContract ? (
                    'Signing...'
                  ) : (
                    <>
                      <PenLine className="h-4 w-4 mr-2" />
                      Sign Contract
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The club has not yet set up a contract document.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!waiverSigned && hasWaiver && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Waiver signature required
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Please sign the club waiver above before registering athletes for programs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!contractSigned && hasContract && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Contract signature required
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Please review and sign the athlete contract above before registering for programs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
