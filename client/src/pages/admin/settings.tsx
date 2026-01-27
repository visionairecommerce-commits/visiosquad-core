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
import { Copy, Plus, Pencil, Trash2, Building2, FileText, MapPin, Palette, RefreshCw, Check } from 'lucide-react';
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

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
  });

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
