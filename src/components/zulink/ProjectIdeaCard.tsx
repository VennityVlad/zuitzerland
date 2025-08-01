import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ThumbsUp, ThumbsDown, Edit3, CheckCircle, XCircle, Settings2, Tag, Link, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Tables } from '@/integrations/supabase/types';
import { useSupabaseJwt } from "@/components/SupabaseJwtProvider";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; 
import { Input } from "@/components/ui/input"; 
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateProjectIdeaSheet } from "@/components/zulink/CreateProjectIdeaSheet";

type ZulinkProject = Tables<'zulink_projects'>;
type ZulinkProjectStatus = ZulinkProject['status']; // 'pending' | 'approved' | 'rejected' | 'implemented'

interface ProjectIdeaCardProps extends ZulinkProject {
  isAdmin: boolean;
  currentUserId?: string;
  onStatusUpdate?: () => void;
}

// URL validation schema
const urlSchema = z.object({
  implementation_url: z.string().url("Please enter a valid URL").min(1, "URL is required")
});

type UrlFormData = z.infer<typeof urlSchema>;

export function ProjectIdeaCard({
  id,
  name,
  description,
  submission_type,
  contribution_type,
  flag,
  benefit_to_zuitzerland,
  support_needed,
  github_link,
  telegram_handle,
  status,
  created_at,
  profile_id,
  implementation_url,
  isAdmin,
  currentUserId,
  onStatusUpdate,
}: ProjectIdeaCardProps) {
  const { authenticatedSupabase } = useSupabaseJwt();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  
  // State for description and benefit expansion
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isBenefitExpanded, setIsBenefitExpanded] = useState(false);

  // Form setup
  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      implementation_url: implementation_url || ""
    }
  });

  // Update form default values when implementation_url changes
  React.useEffect(() => {
    form.reset({ implementation_url: implementation_url || "" });
  }, [implementation_url, form]);

  const handleStatusChange = async (newStatus: ZulinkProjectStatus) => {
    if (!authenticatedSupabase || !isAdmin) return;

    try {
      const { error } = await authenticatedSupabase
        .from('zulink_projects')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Status Updated", description: `Project "${name}" has been ${newStatus}.` });
      if (onStatusUpdate) onStatusUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const handleImplementationUrlSubmit = async (data: UrlFormData) => {
    if (!authenticatedSupabase || !isAdmin) return;

    try {
      const { error } = await authenticatedSupabase
        .from('zulink_projects')
        .update({ 
          status: 'implemented', 
          implementation_url: data.implementation_url 
        })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Project Implemented", description: `Project "${name}" has been marked as implemented.` });
      setIsPopoverOpen(false);
      setIsEditingUrl(false);
      if (onStatusUpdate) onStatusUpdate();
    } catch (error) {
      console.error("Error updating implementation URL:", error);
      toast({ title: "Error", description: "Failed to update implementation URL.", variant: "destructive" });
    }
  };

  const isOwner = profile_id === currentUserId;
  const canEdit = isOwner && status === 'pending';

  const getStatusBadgeVariant = (currentStatus: ZulinkProjectStatus): "default" | "destructive" | "outline" | "secondary" => {
    switch (currentStatus) {
      case 'approved': return 'default'; 
      case 'implemented': return 'default'; 
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };
  
  const formattedDate = new Date(created_at).toLocaleDateString();

  const getFlagBackgroundColor = () => {
    if (flag === 'Green') return '#F2FCE2'; // Soft Green
    if (flag === 'Yellow') return '#FEF7CD'; // Soft Yellow
    return '#F1F0FB'; // Soft Gray (default for 'Grey' or other values)
  };

  // Determine if text should be truncated based on length
  const shouldTruncateDescription = description && description.length > 100;
  const shouldTruncateBenefit = benefit_to_zuitzerland && benefit_to_zuitzerland.length > 100;

  const handleEdit = () => {
    setIsEditSheetOpen(true);
  };

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant={getStatusBadgeVariant(status)} className="capitalize">{status}</Badge>
          </div>
          <CardDescription className="text-xs text-gray-500">
            Submitted on {formattedDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          {/* Description with updated expand/collapse functionality */}
          {description && (
            <div>
              <Collapsible 
                open={isDescriptionExpanded} 
                onOpenChange={setIsDescriptionExpanded} 
                className="space-y-1"
              >
                {/* For collapsed state: show truncated text with "See more" at the end */}
                {!isDescriptionExpanded && (
                  <div className="text-sm text-muted-foreground">
                    {shouldTruncateDescription ? (
                      <>
                        {description.substring(0, 100)}...
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto text-primary hover:text-primary/80 ml-1"
                          >
                            <span className="flex items-center">See more <ChevronDown className="h-3 w-3 ml-1" /></span>
                          </Button>
                        </CollapsibleTrigger>
                      </>
                    ) : (
                      description
                    )}
                  </div>
                )}
                
                {/* For expanded state: show full text with "See less" at the bottom */}
                <CollapsibleContent className="text-sm text-muted-foreground">
                  {description}
                  {shouldTruncateDescription && (
                    <div className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-primary hover:text-primary/80"
                        >
                          <span className="flex items-center">See less <ChevronUp className="h-3 w-3 ml-1" /></span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-xs mb-1">Contribution:</h4>
            <Badge variant="outline">{contribution_type}</Badge>
          </div>
          <div>
            <h4 className="font-semibold text-xs mb-1">Flag:</h4>
            <Badge
              className="flex items-center text-slate-700 dark:text-slate-900" 
              style={{
                backgroundColor: getFlagBackgroundColor(),
              }}
            >
              <Tag className="h-3 w-3 mr-1.5" />
              {flag}
            </Badge>
          </div>
          
          {/* Benefit to Zuitzerland with updated expand/collapse functionality */}
          {benefit_to_zuitzerland && (
            <div>
              <h4 className="font-semibold text-xs mb-1">Benefit to Zuitzerland:</h4>
              <Collapsible 
                open={isBenefitExpanded} 
                onOpenChange={setIsBenefitExpanded} 
                className="space-y-1"
              >
                {/* For collapsed state: show truncated text with "See more" at the end */}
                {!isBenefitExpanded && (
                  <div className="text-sm text-muted-foreground">
                    {shouldTruncateBenefit ? (
                      <>
                        {benefit_to_zuitzerland.substring(0, 100)}...
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto text-primary hover:text-primary/80 ml-1"
                          >
                            <span className="flex items-center">See more <ChevronDown className="h-3 w-3 ml-1" /></span>
                          </Button>
                        </CollapsibleTrigger>
                      </>
                    ) : (
                      benefit_to_zuitzerland
                    )}
                  </div>
                )}
                
                {/* For expanded state: show full text with "See less" at the bottom */}
                <CollapsibleContent className="text-sm text-muted-foreground">
                  {benefit_to_zuitzerland}
                  {shouldTruncateBenefit && (
                    <div className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-primary hover:text-primary/80"
                        >
                          <span className="flex items-center">See less <ChevronUp className="h-3 w-3 ml-1" /></span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
          
          {support_needed && (
            <div>
              <h4 className="font-semibold text-xs mb-1">Support Needed:</h4>
              <p className="text-sm text-muted-foreground">{support_needed}</p>
            </div>
          )}
          {telegram_handle && (
            <p className="text-xs text-gray-500">TG: {telegram_handle}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-4">
          {/* External Links Section */}
          <div className="w-full space-y-2">
            {github_link && (
              <Button variant="outline" size="sm" asChild className="w-full">
                <a href={github_link} target="_blank" rel="noopener noreferrer">
                  <Link className="h-4 w-4 mr-2" /> Link
                </a>
              </Button>
            )}
            
            {implementation_url && status === 'implemented' && (
              <div className="flex w-full gap-2">
                <Button variant="default" size="sm" asChild className="flex-1">
                  <a href={implementation_url} target="_blank" rel="noopener noreferrer">
                    <Link className="h-4 w-4 mr-2" /> Go to App
                  </a>
                </Button>
                
                {isAdmin && (
                  <Popover open={isEditingUrl} onOpenChange={setIsEditingUrl}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Edit App URL</h4>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleImplementationUrlSubmit)} className="space-y-3">
                            <FormField
                              control={form.control}
                              name="implementation_url"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>URL</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://..." {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingUrl(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" size="sm">Save</Button>
                            </div>
                          </form>
                        </Form>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Edit Option for Project Owners */}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleEdit} className="w-full">
              <Pencil className="h-4 w-4 mr-2" /> Edit Project
            </Button>
          )}

          {/* Admin Actions Section */}
          {isAdmin && status === 'pending' && (
            <div className="flex gap-2 w-full">
              <Button variant="default" size="sm" onClick={() => handleStatusChange('approved')} className="flex-1">
                <ThumbsUp className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleStatusChange('rejected')} className="flex-1">
                <ThumbsDown className="h-4 w-4 mr-2" /> Reject
              </Button>
            </div>
          )}
          
          {isAdmin && status === 'approved' && (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" /> Mark as Implemented
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Implementation URL Required</h4>
                  <p className="text-xs text-muted-foreground">
                    Please enter the URL where users can access the implemented project.
                  </p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleImplementationUrlSubmit)} className="space-y-3">
                      <FormField
                        control={form.control}
                        name="implementation_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Implementation URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsPopoverOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" size="sm">Submit</Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {isAdmin && status === 'rejected' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('pending')} className="w-full">
              <Settings2 className="h-4 w-4 mr-2" /> Re-evaluate (Set to Pending)
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Edit Sheet */}
      {isEditSheetOpen && (
        <CreateProjectIdeaSheet 
          onProjectCreated={onStatusUpdate}
          userId={currentUserId}
          isOpen={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          editMode={true}
          projectData={{
            id,
            name,
            description,
            submission_type,
            contribution_type,
            flag,
            benefit_to_zuitzerland,
            support_needed,
            github_link,
            telegram_handle
          }}
        />
      )}
    </>
  );
}
