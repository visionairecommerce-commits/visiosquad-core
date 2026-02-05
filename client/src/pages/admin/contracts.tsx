import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit2, Trash2, DollarSign, Calendar, FileText, HelpCircle, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Program {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  program_id: string;
}

interface ProgramContract {
  id: string;
  club_id: string;
  program_id: string;
  team_id?: string;
  name: string;
  description?: string;
  monthly_price: number;
  paid_in_full_price?: number;
  initiation_fee?: number;
  sessions_per_week: number;
  docuseal_template_id?: string;
  is_active: boolean;
  created_at: string;
}

const contractSchema = z.object({
  program_id: z.string().min(1, "Program is required"),
  team_id: z.string().optional(),
  name: z.string().min(1, "Contract name is required"),
  description: z.string().optional(),
  monthly_price: z.coerce.number().min(0, "Price must be positive"),
  paid_in_full_price: z.coerce.number().min(0).optional().or(z.literal("")),
  initiation_fee: z.coerce.number().min(0).optional().or(z.literal("")),
  sessions_per_week: z.coerce.number().min(1, "At least 1 session per week").max(7, "Maximum 7 sessions per week"),
  docuseal_template_id: z.string()
    .refine((val) => !val || (!val.includes('http') && !val.includes('://') && !val.includes('/')), {
      message: "Please paste a DocuSeal Template ID (not a link).",
    })
    .optional()
    .or(z.literal("")),
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ProgramContract | null>(null);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["/api/programs"],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: contracts = [], isLoading } = useQuery<ProgramContract[]>({
    queryKey: ["/api/program-contracts"],
  });

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      program_id: "",
      team_id: "",
      name: "",
      description: "",
      monthly_price: 0,
      paid_in_full_price: "",
      initiation_fee: "",
      sessions_per_week: 1,
      docuseal_template_id: "",
    },
  });

  const selectedProgramId = form.watch("program_id");
  const teamsForProgram = teams.filter(t => t.program_id === selectedProgramId);

  // Clear team_id when program changes to avoid invalid team/program combinations
  const prevProgramIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevProgramIdRef.current !== null && prevProgramIdRef.current !== selectedProgramId) {
      form.setValue("team_id", "");
    }
    prevProgramIdRef.current = selectedProgramId;
  }, [selectedProgramId, form]);

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) =>
      apiRequest("POST", "/api/program-contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-contracts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Contract created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create contract", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractFormData> }) =>
      apiRequest("PATCH", `/api/program-contracts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-contracts"] });
      setIsDialogOpen(false);
      setEditingContract(null);
      form.reset();
      toast({ title: "Success", description: "Contract updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contract", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/program-contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/program-contracts"] });
      toast({ title: "Success", description: "Contract deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" });
    },
  });

  const handleOpenDialog = (contract?: ProgramContract) => {
    if (contract) {
      setEditingContract(contract);
      form.reset({
        program_id: contract.program_id,
        team_id: contract.team_id || "",
        name: contract.name,
        description: contract.description || "",
        monthly_price: contract.monthly_price,
        paid_in_full_price: contract.paid_in_full_price || "",
        initiation_fee: contract.initiation_fee || "",
        sessions_per_week: contract.sessions_per_week,
        docuseal_template_id: contract.docuseal_template_id || "",
      });
    } else {
      setEditingContract(null);
      form.reset({
        program_id: "",
        team_id: "",
        name: "",
        description: "",
        monthly_price: 0,
        paid_in_full_price: "",
        initiation_fee: "",
        sessions_per_week: 1,
        docuseal_template_id: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: ContractFormData) => {
    // Normalize empty values to undefined for backend
    const normalizedData = {
      ...data,
      team_id: data.team_id || undefined,
      paid_in_full_price: data.paid_in_full_price === "" ? undefined : Number(data.paid_in_full_price),
      initiation_fee: data.initiation_fee === "" ? undefined : Number(data.initiation_fee),
    };
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data: normalizedData });
    } else {
      createMutation.mutate(normalizedData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this contract?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredContracts = selectedProgramFilter === "all"
    ? contracts
    : contracts.filter(c => c.program_id === selectedProgramFilter);

  const getProgramName = (programId: string) => {
    return programs.find(p => p.id === programId)?.name || "Unknown Program";
  };

  const getTeamName = (teamId?: string) => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId)?.name;
  };

  const groupedContracts = filteredContracts.reduce((acc, contract) => {
    const programId = contract.program_id;
    if (!acc[programId]) {
      acc[programId] = [];
    }
    acc[programId].push(contract);
    return acc;
  }, {} as Record<string, ProgramContract[]>);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-contracts-title">Program Contracts</h1>
          <p className="text-muted-foreground mt-1">
            Define pricing tiers and session limits for each program
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-contract">
              <Plus className="h-4 w-4 mr-2" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingContract ? "Edit Contract" : "Create New Contract"}</DialogTitle>
              <DialogDescription>
                {editingContract
                  ? "Update the contract details below."
                  : "Define a new pricing tier for a program. Athletes can subscribe to this contract to access sessions."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <FormField
                  control={form.control}
                  name="program_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contract-program">
                            <SelectValue placeholder="Select a program" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {teamsForProgram.length > 0 && (
                  <FormField
                    control={form.control}
                    name="team_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contract-team">
                              <SelectValue placeholder="All teams in program" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">All teams in program</SelectItem>
                            {teamsForProgram.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Optionally limit this contract to a specific team
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 4 Days/Week - Premium"
                          {...field}
                          data-testid="input-contract-name"
                        />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for this pricing tier
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what's included in this contract..."
                          {...field}
                          data-testid="input-contract-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthly_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Price ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            data-testid="input-contract-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sessions_per_week"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sessions/Week</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="7"
                            {...field}
                            data-testid="input-contract-sessions"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paid_in_full_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid-in-Full Price ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Optional"
                            {...field}
                            data-testid="input-contract-paid-in-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Discounted price if paid upfront
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initiation_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initiation Fee ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Optional"
                            {...field}
                            data-testid="input-contract-initiation-fee"
                          />
                        </FormControl>
                        <FormDescription>
                          One-time fee at signup
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="docuseal_template_id"
                  render={({ field }) => {
                    const selectedProgram = programs.find(p => p.id === form.watch("program_id"));
                    const selectedTeam = teams.find(t => t.id === form.watch("team_id"));
                    const programName = selectedProgram?.name || "my program";
                    const teamName = selectedTeam?.name || "";
                    
                    const emailSubject = encodeURIComponent(`DocuSeal Setup Request for ${programName}${teamName ? ` - ${teamName}` : ""}`);
                    const emailBody = encodeURIComponent(
`Hi VisioSquad Team,

I would like to request DocuSeal e-signature setup for my club.

Program: ${programName}${teamName ? `\nTeam: ${teamName}` : ""}

Please let me know the next steps to get started with electronic contract signing.

Thank you!`
                    );
                    const mailtoLink = `mailto:visionairecommerce@gmail.com?subject=${emailSubject}&body=${emailBody}`;
                    
                    return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        DocuSeal Template ID (Optional)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-sm">
                                <strong>Where to find this:</strong><br />
                                DocuSeal → Templates → open your template → copy Template ID → paste here.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="tpl_xxxxxxxxxxxxx"
                          {...field}
                          data-testid="input-docuseal-template-id"
                        />
                      </FormControl>
                      <FormDescription>
                        Paste the Template ID from DocuSeal. You only paste this once per contract. The app will automatically generate athlete-specific signing links.
                      </FormDescription>
                      <FormMessage />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 justify-start mt-2"
                        asChild
                        data-testid="button-contact-visiosquad-admin"
                      >
                        <a href={mailtoLink}>
                          <Mail className="h-4 w-4 mr-2" />
                          Contact VisioSquad Admin for DocuSeal setup
                        </a>
                      </Button>
                    </FormItem>
                  )}}
                />
                </div>

                <DialogFooter className="mt-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-contract"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save Contract"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedProgramFilter} onValueChange={setSelectedProgramFilter}>
          <SelectTrigger className="w-[250px]" data-testid="select-program-filter">
            <SelectValue placeholder="Filter by program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading contracts...</div>
        </div>
      ) : Object.keys(groupedContracts).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Contracts Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create pricing tiers for your programs. Athletes can subscribe to contracts to access sessions.
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-contract">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Contract
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedContracts).map(([programId, programContracts]) => (
            <Card key={programId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {getProgramName(programId)}
                </CardTitle>
                <CardDescription>
                  {programContracts.length} pricing tier{programContracts.length !== 1 ? "s" : ""} available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {programContracts.map((contract) => (
                    <Card
                      key={contract.id}
                      className={`relative ${!contract.is_active ? "opacity-60" : ""}`}
                      data-testid={`card-contract-${contract.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{contract.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {contract.team_id && getTeamName(contract.team_id) && (
                                <Badge variant="outline" data-testid={`badge-team-${contract.id}`}>
                                  {getTeamName(contract.team_id)}
                                </Badge>
                              )}
                              {!contract.is_active && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(contract)}
                              data-testid={`button-edit-contract-${contract.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(contract.id)}
                              data-testid={`button-delete-contract-${contract.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {contract.description && (
                          <p className="text-sm text-muted-foreground mb-4">{contract.description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-semibold text-lg">${contract.monthly_price}</span>
                              <span className="text-muted-foreground text-sm">/month</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{contract.sessions_per_week}</span>
                              <span className="text-muted-foreground text-sm">days/week</span>
                            </div>
                          </div>
                          {(contract.paid_in_full_price || contract.initiation_fee) && (
                            <div className="flex items-center gap-3 text-sm flex-wrap">
                              {contract.paid_in_full_price && (
                                <span className="text-muted-foreground">
                                  Paid-in-full: <span className="font-medium text-foreground">${contract.paid_in_full_price}</span>
                                </span>
                              )}
                              {contract.initiation_fee && (
                                <span className="text-muted-foreground">
                                  Initiation: <span className="font-medium text-foreground">${contract.initiation_fee}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
