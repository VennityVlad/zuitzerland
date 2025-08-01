
import { useState, useEffect } from "react";
import { UserPlus, UserMinus, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type TeamMembersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  onMembersUpdated?: () => void;
};

type Profile = {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  team_id: string | null;
};

const TeamMembersDialog = ({ 
  open, 
  onOpenChange, 
  team, 
  onMembersUpdated 
}: TeamMembersDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [showAddMemberSheet, setShowAddMemberSheet] = useState(false);

  // Fetch team members
  const fetchTeamMembers = async () => {
    setIsLoading(true);
    try {
      const { data: members, error } = await supabase
        .from("profiles")
        .select("id, username, email, full_name, avatar_url, role, team_id")
        .eq("team_id", team.id);

      if (error) throw error;
      setTeamMembers(members || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available users (not assigned to any team)
  const fetchAvailableUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, username, email, full_name, avatar_url, role, team_id")
        .is("team_id", null);

      if (error) throw error;
      setAvailableUsers(users || []);
      setFilteredUsers(users || []);
    } catch (error) {
      console.error("Error fetching available users:", error);
      toast({
        title: "Error",
        description: "Failed to load available users",
        variant: "destructive",
      });
    }
  };

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchAvailableUsers();
    }
  }, [open, team.id]);

  // Filter available users based on search term
  useEffect(() => {
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      const filtered = availableUsers.filter(
        user =>
          (user.username?.toLowerCase().includes(lowercaseSearch) || false) ||
          (user.email?.toLowerCase().includes(lowercaseSearch) || false) ||
          (user.full_name?.toLowerCase().includes(lowercaseSearch) || false)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(availableUsers);
    }
  }, [searchTerm, availableUsers]);

  // Add user to team
  const handleAddMember = async (userId: string) => {
    setIsAddingMember(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ team_id: team.id })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Member added",
        description: "User has been added to the team successfully",
      });

      // Refresh data
      fetchTeamMembers();
      fetchAvailableUsers();
      if (onMembersUpdated) onMembersUpdated();
    } catch (error) {
      console.error("Error adding team member:", error);
      toast({
        title: "Error",
        description: "Failed to add member to team",
        variant: "destructive",
      });
    } finally {
      setIsAddingMember(false);
    }
  };

  // Remove user from team
  const handleRemoveMember = async (userId: string) => {
    setIsRemovingMember(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ team_id: null })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "User has been removed from the team",
      });

      // Refresh data
      fetchTeamMembers();
      fetchAvailableUsers();
      if (onMembersUpdated) onMembersUpdated();
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member from team",
        variant: "destructive",
      });
    } finally {
      setIsRemovingMember(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Team Members - {team.name}</DialogTitle>
            <DialogDescription>
              View and manage members of this team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Current Team Members</h3>
              <Button
                onClick={() => setShowAddMemberSheet(true)}
                type="button"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : teamMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback>
                              {member.full_name
                                ? getInitials(member.full_name)
                                : member.username?.substring(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {member.full_name || member.username}
                            </div>
                            {member.email && (
                              <div className="text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.role ? (
                          <Badge variant="outline">{member.role}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={isRemovingMember}
                          type="button"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No members in this team yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowAddMemberSheet(true)}
                  type="button"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add your first member
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showAddMemberSheet} onOpenChange={setShowAddMemberSheet}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
          <SheetHeader className="p-6 border-b">
            <SheetTitle>Add a team member</SheetTitle>
          </SheetHeader>
          <div className="p-6 space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                value={searchTerm}
                autoFocus
              />
            </div>
            
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-4 cursor-pointer hover:bg-muted/50 px-2 rounded-md transition-colors"
                    onClick={() => {
                      handleAddMember(user.id);
                      setShowAddMemberSheet(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {user.full_name
                            ? getInitials(user.full_name)
                            : user.username?.substring(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {user.full_name || user.username}
                        </p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No available users found</p>
                </div>
              )}
              
              {searchTerm && filteredUsers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No users match your search</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default TeamMembersDialog;
