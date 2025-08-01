
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageTitle } from "@/components/PageTitle";
import { CreateDiscountSheet } from "@/components/discounts/CreateDiscountSheet";

interface Discount {
  id: string;
  percentage: number;
  active: boolean;
  is_role_based: boolean;
  start_date: string | null;
  end_date: string | null;
  discountName: string | null;
}

const Discounts = () => {
  const { user } = usePrivy();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Discount>>({});
  const [isNewDiscountSheetOpen, setIsNewDiscountSheetOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('privy_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        setIsAdmin(data?.role === 'admin');
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAdmin) {
      fetchDiscounts();
    }
  }, [isAdmin]);

  const fetchDiscounts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("Fetched discounts:", data);
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error fetching discounts:', error);
      toast({
        title: "Error",
        description: "Failed to load discounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    const discount = discounts.find(d => d.id === id);
    if (discount) {
      console.log("Editing discount:", discount);
      setEditValues({...discount});
      setIsEditing(id);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(null);
    setEditValues({});
  };

  const handleSaveEdit = async (id: string) => {
    try {
      console.log("Saving edited discount:", id, editValues);
      
      if (!editValues.percentage || editValues.percentage <= 0 || editValues.percentage > 100) {
        toast({
          title: "Error",
          description: "Percentage must be between 1 and 100",
          variant: "destructive",
        });
        return;
      }

      if (!editValues.discountName) {
        toast({
          title: "Error",
          description: "Discount name is required",
          variant: "destructive",
        });
        return;
      }

      const updateData = {
        percentage: editValues.percentage,
        active: editValues.active,
        is_role_based: editValues.is_role_based,
        start_date: editValues.start_date,
        end_date: editValues.end_date,
        discountName: editValues.discountName
      };

      console.log("Sending update to Supabase:", updateData);
      
      const { data, error } = await supabase
        .from('discounts')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }

      console.log("Update response from Supabase:", data);

      toast({
        title: "Success",
        description: "Discount updated successfully",
      });
      
      setDiscounts(prevDiscounts => 
        prevDiscounts.map(d => d.id === id ? { ...d, ...updateData } : d)
      );
      
      fetchDiscounts();
      setIsEditing(null);
      setEditValues({});
    } catch (error) {
      console.error('Error updating discount:', error);
      toast({
        title: "Error",
        description: "Failed to update discount: " + (error instanceof Error ? error.message : "Unknown error"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteDiscount = async (id: string) => {
    try {
      console.log("Deleting discount:", id);
      
      const { error } = await supabase
        .from('discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Discount deleted successfully",
      });
      
      setDiscounts(prevDiscounts => prevDiscounts.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast({
        title: "Error",
        description: "Failed to delete discount",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 py-12">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-secondary/30 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-red-600">Access Denied</h1>
            <p className="mt-2">You do not have permission to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageTitle title="Discount Management" />
      <div className="flex-grow bg-secondary/30 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
            <div className="flex justify-end mb-6">
              <Button 
                onClick={() => setIsNewDiscountSheetOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add New Discount
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {discounts.map((discount) => (
                <Card key={discount.id} className={`${discount.active ? 'border-green-300' : 'border-gray-300 opacity-70'}`}>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span className="truncate">{discount.discountName || 'Unnamed Discount'}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {discount.percentage}%
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {discount.is_role_based ? 'Role-based discount' : 'Regular discount'}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {isEditing === discount.id ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${discount.id}`}>Discount Name</Label>
                          <Input 
                            id={`name-${discount.id}`}
                            value={editValues.discountName || ''}
                            onChange={(e) => setEditValues({...editValues, discountName: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`percentage-${discount.id}`}>Percentage (%)</Label>
                          <Input 
                            id={`percentage-${discount.id}`}
                            type="number"
                            min={1}
                            max={100}
                            value={editValues.percentage || 0}
                            onChange={(e) => setEditValues({...editValues, percentage: Number(e.target.value)})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editValues.start_date ? format(parseISO(editValues.start_date), 'PPP') : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={editValues.start_date ? parseISO(editValues.start_date) : undefined}
                                onSelect={(date) => date && setEditValues({...editValues, start_date: format(date, 'yyyy-MM-dd')})}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editValues.end_date ? format(parseISO(editValues.end_date), 'PPP') : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={editValues.end_date ? parseISO(editValues.end_date) : undefined}
                                onSelect={(date) => date && setEditValues({...editValues, end_date: format(date, 'yyyy-MM-dd')})}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`active-${discount.id}`}
                            checked={editValues.active || false}
                            onCheckedChange={(checked) => setEditValues({...editValues, active: checked})}
                          />
                          <Label htmlFor={`active-${discount.id}`}>Active</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`role-based-${discount.id}`}
                            checked={editValues.is_role_based || false}
                            onCheckedChange={(checked) => setEditValues({...editValues, is_role_based: checked})}
                          />
                          <Label htmlFor={`role-based-${discount.id}`}>Role-based discount</Label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Status:</span>
                          <span className={`text-sm ${discount.active ? 'text-green-600' : 'text-gray-500'}`}>
                            {discount.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Date Range:</span>
                          <span className="text-sm">
                            {discount.start_date ? format(parseISO(discount.start_date), 'MMM d, yyyy') : 'N/A'} - 
                            {discount.end_date ? format(parseISO(discount.end_date), 'MMM d, yyyy') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="flex justify-between">
                    {isEditing === discount.id ? (
                      <>
                        <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                        <Button onClick={() => handleSaveEdit(discount.id)}>Save</Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => handleEdit(discount.id)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => handleDeleteDiscount(discount.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>

            {discounts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No discounts found. Create your first discount using the button above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <CreateDiscountSheet 
        open={isNewDiscountSheetOpen}
        onOpenChange={setIsNewDiscountSheetOpen}
        onSuccess={fetchDiscounts}
      />
    </div>
  );
};

export default Discounts;
