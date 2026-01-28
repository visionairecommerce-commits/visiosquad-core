import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { ClubForm } from '@shared/schema';

export default function ParentFormsPage() {
  const { data: forms = [], isLoading } = useQuery<ClubForm[]>({
    queryKey: ['/api/club-forms'],
  });

  const activeForms = forms.filter(f => f.is_active);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Forms & Links</h1>
        <p className="text-muted-foreground">
          Important forms and resources from your club
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeForms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No forms available</h3>
            <p className="text-muted-foreground">
              Your club hasn't added any forms or links yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeForms.map((form) => (
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
                    asChild
                    data-testid={`button-open-form-${form.id}`}
                  >
                    <a
                      href={form.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Form
                    </a>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
