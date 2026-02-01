import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users, FileCheck, CreditCard, AlertCircle, CheckCircle2, Clock, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface Program {
  id: string;
  name: string;
  description?: string;
  monthly_fee: number;
}

interface ProgramRosterEntry {
  id: string;
  athlete_id: string;
  team_id: string | null;
  program_id: string;
  club_id: string;
  contract_signed: boolean;
  created_at: string;
  athlete: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    paid_through_date?: string;
    is_locked: boolean;
  } | null;
  contract_status: 'signed' | 'pending';
  payment_status: 'current' | 'overdue' | 'no_contract';
  payment_plan: string | null;
}

export default function ProgramRosterPage() {
  const { programId } = useParams<{ programId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/roster/export`, {
        headers: {
          'X-User-Role': localStorage.getItem('visiosport_role') || '',
          'X-User-Id': localStorage.getItem('visiosport_user_id') || '',
          'X-Club-Id': localStorage.getItem('visiosport_club_id') || '',
        },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'roster.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Roster exported successfully' });
    } catch (error) {
      toast({ title: 'Failed to export roster', variant: 'destructive' });
    }
  };

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const { data: roster = [], isLoading } = useQuery<ProgramRosterEntry[]>({
    queryKey: ['/api/programs', programId, 'roster'],
    enabled: !!programId,
  });

  const program = programs.find(p => p.id === programId);

  const getContractBadge = (status: 'signed' | 'pending') => {
    if (status === 'signed') {
      return (
        <Badge variant="default" className="bg-green-600" data-testid="badge-contract-signed">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Signed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" data-testid="badge-contract-pending">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getPaymentBadge = (status: 'current' | 'overdue' | 'no_contract') => {
    switch (status) {
      case 'current':
        return (
          <Badge variant="default" className="bg-green-600" data-testid="badge-payment-current">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Current
          </Badge>
        );
      case 'overdue':
        return (
          <Badge variant="destructive" data-testid="badge-payment-overdue">
            <AlertCircle className="w-3 h-3 mr-1" />
            Overdue
          </Badge>
        );
      case 'no_contract':
        return (
          <Badge variant="outline" data-testid="badge-payment-none">
            No Contract
          </Badge>
        );
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const stats = {
    total: roster.length,
    contractSigned: roster.filter(r => r.contract_status === 'signed').length,
    paymentCurrent: roster.filter(r => r.payment_status === 'current').length,
    paymentOverdue: roster.filter(r => r.payment_status === 'overdue').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/programs')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {program?.name || 'Program'} Roster
            </h1>
            <p className="text-muted-foreground">
              View athletes enrolled in this program with their contract and payment status
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExport}
          disabled={roster.length === 0}
          data-testid="button-export-roster"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-stat-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-signed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contracts Signed</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.contractSigned}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.contractSigned / stats.total) * 100) : 0}% of roster
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-current">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Current</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paymentCurrent}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-overdue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.paymentOverdue}</div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-roster-table">
        <CardHeader>
          <CardTitle>Enrolled Athletes</CardTitle>
          <CardDescription>
            Athletes enrolled in this program with their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : roster.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-roster">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No athletes enrolled in this program yet.</p>
              <p className="text-sm mt-2">Athletes will appear here when they sign a contract for this program.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Payment Plan</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Paid Through</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-athlete-${entry.athlete_id}`}>
                    <TableCell className="font-medium">
                      {entry.athlete ? (
                        `${entry.athlete.first_name} ${entry.athlete.last_name}`
                      ) : (
                        <span className="text-muted-foreground">Unknown Athlete</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.athlete?.date_of_birth ? calculateAge(entry.athlete.date_of_birth) : '-'}
                    </TableCell>
                    <TableCell>
                      {getContractBadge(entry.contract_status)}
                    </TableCell>
                    <TableCell>
                      {entry.payment_plan ? (
                        <span className="capitalize">{entry.payment_plan.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getPaymentBadge(entry.payment_status)}
                    </TableCell>
                    <TableCell>
                      {entry.athlete?.paid_through_date ? (
                        new Date(entry.athlete.paid_through_date).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
