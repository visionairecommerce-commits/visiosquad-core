import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Shield, Check, Clock, AlertCircle, FileText, Loader2 } from 'lucide-react';
import type { User, ContractStatus } from '@shared/schema';

interface UserWithContract extends User {
  contract_status?: ContractStatus;
  contract_method?: 'digital' | 'paper';
}

export default function ContractCompliancePage() {
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<UserWithContract[]>({
    queryKey: ['/api/contract-compliance'],
  });

  const verifyContractMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}/verify-contract`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-compliance'] });
      toast({ title: 'Contract verified successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to verify contract', variant: 'destructive' });
    },
  });

  const getStatusBadge = (status?: ContractStatus, method?: 'digital' | 'paper') => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="default" className="bg-green-600" data-testid="badge-verified">
            <Check className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" data-testid="badge-pending">
            <Clock className="h-3 w-3 mr-1" />
            Pending ({method === 'digital' ? 'Digital' : 'Paper'})
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" data-testid="badge-unsigned">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unsigned
          </Badge>
        );
    }
  };

  const pendingUsers = users.filter(u => u.contract_status === 'pending');
  const unsignedUsers = users.filter(u => !u.contract_status || u.contract_status === 'unsigned');
  const verifiedUsers = users.filter(u => u.contract_status === 'verified');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Contract Compliance
        </h1>
        <p className="text-muted-foreground">
          Track and verify parent contract signatures
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="count-pending">{pendingUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unsigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="count-unsigned">{unsignedUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="count-verified">{verifiedUsers.length}</div>
          </CardContent>
        </Card>
      </div>

      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Verification
            </CardTitle>
            <CardDescription>
              These parents have indicated they signed a contract. Please verify and approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-user-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium" data-testid={`text-name-${user.id}`}>{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    {getStatusBadge(user.contract_status, user.contract_method)}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => verifyContractMutation.mutate(user.id)}
                    disabled={verifyContractMutation.isPending}
                    data-testid={`button-verify-${user.id}`}
                  >
                    {verifyContractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Verify Contract
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unsignedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Unsigned Contracts
            </CardTitle>
            <CardDescription>
              These parents have not yet signed or indicated signing a contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unsignedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-user-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium" data-testid={`text-name-${user.id}`}>{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    {getStatusBadge(user.contract_status, user.contract_method)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyContractMutation.mutate(user.id)}
                    disabled={verifyContractMutation.isPending}
                    data-testid={`button-verify-${user.id}`}
                  >
                    {verifyContractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Verify Contract
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {verifiedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Verified Contracts
            </CardTitle>
            <CardDescription>
              These parents have verified contracts on file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verifiedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  data-testid={`row-user-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium" data-testid={`text-name-${user.id}`}>{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    {getStatusBadge(user.contract_status, user.contract_method)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {users.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Parents Found</p>
            <p className="text-muted-foreground text-center max-w-md">
              Parents who join your club will appear here for contract verification.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
