import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Building2,
  Camera,
  MapPin,
  Phone,
  Mail,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

interface ClubProfileData {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
}

interface ClubProfileCardProps {
  club: ClubProfileData;
}

export function ClubProfileCard({ club }: ClubProfileCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: club.name || '',
    address: club.address || '',
    contact_phone: club.contact_phone || '',
    contact_email: club.contact_email || '',
  });
  const [savedLogo, setSavedLogo] = useState<string | null>(club.logo_url || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const incompleteFields = [
    !savedLogo && !logoPreview && 'Logo',
    !formData.address && 'Address',
    !formData.contact_phone && 'Phone',
    !formData.contact_email && 'Email',
  ].filter(Boolean);

  const profileCompletionPercent = Math.round(
    ((4 - incompleteFields.length) / 4) * 100
  );

  const updateMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      address?: string;
      contact_phone?: string;
      contact_email?: string;
      logo_url?: string;
    }) => {
      const response = await apiRequest('PUT', `/api/clubs/${club.id}/settings`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/session'] });
      toast({
        title: 'Profile updated',
        description: 'Your club profile has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image under 5MB',
          variant: 'destructive',
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);
      
      const response = await fetch('/api/clubs/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      const result = await response.json();
      return result.logo_url;
    } catch (error) {
      console.error('Logo upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      let newLogoUrl: string | undefined;
      
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          newLogoUrl = uploadedUrl;
          setSavedLogo(uploadedUrl);
        }
      }
      
      await updateMutation.mutateAsync({
        name: formData.name,
        address: formData.address || undefined,
        contact_phone: formData.contact_phone || undefined,
        contact_email: formData.contact_email || undefined,
        logo_url: newLogoUrl,
      });
      
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const hasChanges = 
    formData.name !== (club.name || '') ||
    formData.address !== (club.address || '') ||
    formData.contact_phone !== (club.contact_phone || '') ||
    formData.contact_email !== (club.contact_email || '') ||
    logoFile !== null;

  const openInMaps = () => {
    if (formData.address) {
      const encodedAddress = encodeURIComponent(formData.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  return (
    <Card data-testid="card-club-profile">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Club Profile
              {incompleteFields.length > 0 && (
                <Badge variant="destructive" className="ml-2" data-testid="badge-incomplete-count">
                  {incompleteFields.length} incomplete
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage your club's public information
            </CardDescription>
          </div>
          {profileCompletionPercent < 100 && (
            <div className="text-sm text-muted-foreground">
              Profile: {profileCompletionPercent}% complete
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-border">
              <AvatarImage src={logoPreview || club.logo_url} alt={club.name} />
              <AvatarFallback className="text-2xl bg-primary/10">
                {club.name?.charAt(0)?.toUpperCase() || 'C'}
              </AvatarFallback>
            </Avatar>
            {!club.logo_url && !logoPreview && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center" data-testid="badge-logo-incomplete">
                <AlertCircle className="h-3 w-3 text-destructive-foreground" />
              </div>
            )}
            <Button
              size="icon"
              variant="outline"
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-upload-logo"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
              data-testid="input-logo-file"
            />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="club-name">Club Name</Label>
              <Input
                id="club-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter club name"
                data-testid="input-club-name"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="club-address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
              {!formData.address && (
                <span className="h-2 w-2 bg-destructive rounded-full" data-testid="badge-address-incomplete" />
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="club-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State ZIP"
                className="flex-1"
                data-testid="input-club-address"
              />
              {formData.address && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={openInMaps}
                  title="Open in Google Maps"
                  data-testid="button-open-maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="club-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Phone
              {!formData.contact_phone && (
                <span className="h-2 w-2 bg-destructive rounded-full" data-testid="badge-phone-incomplete" />
              )}
            </Label>
            <Input
              id="club-phone"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="(555) 123-4567"
              data-testid="input-club-phone"
            />
          </div>
          
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="club-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact Email
              {!formData.contact_email && (
                <span className="h-2 w-2 bg-destructive rounded-full" data-testid="badge-email-incomplete" />
              )}
            </Label>
            <Input
              id="club-email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="info@yourclub.com"
              data-testid="input-club-email"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t">
          {incompleteFields.length > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Complete your profile: {incompleteFields.join(', ')}
            </p>
          )}
          <div className="flex-1" />
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending || isUploading}
            data-testid="button-save-profile"
          >
            {(updateMutation.isPending || isUploading) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
