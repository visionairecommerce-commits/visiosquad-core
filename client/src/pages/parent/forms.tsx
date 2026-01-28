import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ExternalLink, FileText, Loader2, Sparkles } from 'lucide-react';
import { useAthlete } from '@/contexts/AthleteContext';
import { AthleteSwitcher } from '@/components/AthleteSwitcher';
import type { ClubForm } from '@shared/schema';

interface FormWithViewed extends ClubForm {
  viewed: boolean;
}

export default function ParentFormsPage() {
  const { activeAthlete } = useAthlete();

  const { data: forms = [], isLoading } = useQuery<FormWithViewed[]>({
    queryKey: ['/api/athletes', activeAthlete?.id, 'forms'],
    enabled: !!activeAthlete?.id,
  });

  const markViewedMutation = useMutation({
    mutationFn: async (formId: string) => {
      const response = await apiRequest('POST', `/api/club-forms/${formId}/view`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/athletes', activeAthlete?.id, 'forms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-unviewed-forms-count'] });
    },
  });

  const handleOpenForm = (form: FormWithViewed) => {
    window.open(form.url, '_blank');
    if (!form.viewed) {
      markViewedMutation.mutate(form.id);
    }
  };

  const newForms = forms.filter(f => !f.viewed);
  const viewedForms = forms.filter(f => f.viewed);

  if (!activeAthlete) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Forms & Links</h1>
          <p className="text-muted-foreground">
            Please add an athlete to view available forms
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Forms & Links</h1>
          <p className="text-muted-foreground">
            Important forms and resources for {activeAthlete.first_name}
          </p>
        </div>
        <AthleteSwitcher />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No forms available</h3>
            <p className="text-muted-foreground">
              There are no forms assigned to {activeAthlete.first_name}'s programs or teams yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {newForms.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                New Forms
                <Badge variant="secondary">{newForms.length}</Badge>
              </h2>
              {newForms.map((form) => (
                <Card key={form.id} className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" data-testid={`form-card-new-${form.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{form.name}</CardTitle>
                          <Badge variant="default" className="text-xs">New</Badge>
                        </div>
                        {form.description && (
                          <CardDescription className="mt-1">
                            {form.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        onClick={() => handleOpenForm(form)}
                        data-testid={`button-open-form-${form.id}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Form
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {viewedForms.length > 0 && (
            <div className="space-y-3">
              {newForms.length > 0 && (
                <h2 className="text-lg font-semibold text-muted-foreground">Previously Viewed</h2>
              )}
              {viewedForms.map((form) => (
                <Card key={form.id} data-testid={`form-card-${form.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{form.name}</CardTitle>
                        {form.description && (
                          <CardDescription className="mt-1">
                            {form.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleOpenForm(form)}
                        data-testid={`button-open-form-${form.id}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Form
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
