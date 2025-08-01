import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, addHours, startOfHour, addMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock, Link, AlertTriangle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { toZonedTime } from "date-fns-tz";
import { convertToUTC } from "@/lib/date-utils";

// UI Component imports
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagSelector } from "@/components/events/TagSelector";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// Type definitions
interface CreateEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (eventId: string) => void;
  userId: string;
  profileId?: string;
  event?: Event | null;
  userProfileData?: { id: string; role?: string };  // New prop to receive user profile data
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  location_id: string | null;
  location_text: string | null;
  color: string;
  is_all_day: boolean;
  created_by: string;
  tags?: { id: string; name: string; color: string; }[];
  av_needs?: string | null;
  speakers?: string | null;
  link?: string | null;
  timezone: string;
  recurring_pattern_id: string | null;
  is_recurring_instance: boolean;
  meerkat_enabled?: boolean;
  meerkat_url?: string;
}

interface Location {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  type: string;
  description?: string | null;
  max_occupancy?: number | null;
  created_at: string;
  updated_at: string;
  anyone_can_book: boolean;
}

interface Availability {
  id: string;
  location_id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface NewEvent {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location_id: string | null;
  location_text: string | null;
  color: string;
  is_all_day: boolean;
  created_by: string;
  av_needs?: string | null;
  speakers?: string | null;
  link?: string | null;
  timezone: string;
  recurring_pattern_id: string | null;
  is_recurring_instance: boolean;
  meerkat_enabled?: boolean;
}

const TIME_ZONES = [
  { value: 'Europe/Zurich', label: 'Central European Time (CEST)' },
  { value: 'Europe/London', label: 'British Time (BST)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const getInitialStartDate = () => {
  const now = new Date();
  const nextHour = startOfHour(addHours(now, 1));
  return format(nextHour, "yyyy-MM-dd'T'HH:mm:ss");
};

const getInitialEndDate = (startDate: string) => {
  const start = parseISO(startDate);
  const end = addHours(start, 1);
  return format(end, "yyyy-MM-dd'T'HH:mm:ss");
};

export function CreateEventSheet({ 
  open, 
  onOpenChange, 
  onSuccess, 
  userId, 
  profileId, 
  event,
  userProfileData 
}: CreateEventSheetProps) {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const [userProfile, setUserProfile] = useState<{ id: string; role?: string } | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationAvailabilities, setLocationAvailabilities] = useState<Availability[]>([]);
  const [availabilityValidationError, setAvailabilityValidationError] = useState<string | null>(null);
  const [overlapValidationError, setOverlapValidationError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string; color: string; }[]>([]);
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [locationRequired, setLocationRequired] = useState(false);
  
  // New state for Meerkat integration
  const [isCreatingMeerkatEvent, setIsCreatingMeerkatEvent] = useState(false);
  const [meerkatUrl, setMeerkatUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!event;

  const [newEvent, setNewEvent] = useState<NewEvent>({
    title: "",
    description: "",
    start_date: getInitialStartDate(),
    end_date: getInitialEndDate(getInitialStartDate()),
    location_id: null,
    location_text: "",
    color: "#1a365d",
    is_all_day: false,
    created_by: "",
    av_needs: "",
    speakers: "",
    link: "",
    timezone: 'Europe/Zurich',
    recurring_pattern_id: null,
    is_recurring_instance: false,
    meerkat_enabled: true  // Changed from false to true to make it enabled by default
  });

  useEffect(() => {
    if (event) {
      console.log('Editing existing event:', event);
      setNewEvent({
        title: event.title,
        description: event.description || "",
        start_date: event.start_date,
        end_date: event.end_date,
        location_id: event.location_id,
        location_text: event.location_text || "",
        color: event.color,
        is_all_day: event.is_all_day,
        created_by: event.created_by,
        av_needs: event.av_needs,
        speakers: event.speakers,
        link: event.link,
        timezone: event.timezone || 'Europe/Zurich',
        recurring_pattern_id: event.recurring_pattern_id,
        is_recurring_instance: event.is_recurring_instance,
        meerkat_enabled: event.meerkat_enabled || false
      });
      
      setUseCustomLocation(!!event.location_text);
      
      if (event.meerkat_url) {
        setMeerkatUrl(event.meerkat_url);
      }
      
      if (event.id) {
        fetchEventTags(event.id);
      }
      
      console.log('Initialized form with event dates:', {
        start_date: event.start_date,
        end_date: event.end_date,
        timezone: event.timezone || 'Europe/Zurich'
      });
    } else {
      resetForm();
    }
  }, [event]);

  const fetchEventTags = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_tag_relations')
        .select(`
          tag_id,
          event_tags (id, name, color)
        `)
        .eq('event_id', eventId);
      
      if (error) throw error;
      
      if (data) {
        const tags = data.map(item => ({
          id: item.event_tags.id,
          name: item.event_tags.name,
          color: item.event_tags.color || "#1a365d"
        }));
        
        setSelectedTags(tags);
      }
    } catch (error) {
      console.error("Error fetching event tags:", error);
    }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLoadingLocations(true);
        
        if (!userProfile) {
          console.log("User profile not available yet");
          return;
        }
        
        console.log("Fetching locations with userProfile:", userProfile);
        
        // Fetch ALL locations of type 'Meeting Room'
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .eq('type', 'Meeting Room')
          .order('name');
        
        if (error) {
          console.error("Error fetching locations:", error);
          throw error;
        }
        
        // Apply role-based filtering purely on the client side
        const userRole = userProfile.role || 'attendee';
        console.log("Current user role for filtering:", userRole);
        
        // First check if user is an admin, co-curator, or co-designer
        const isAdminRole = userRole === 'admin' || userRole === 'co-curator' || userRole === 'co-designer';
        
        let filteredLocations;
        if (isAdminRole) {
          // Admin roles can book any location, regardless of anyone_can_book setting
          console.log("User has admin permissions, showing all locations");
          filteredLocations = data || [];
        } else {
          // Non-admin roles can only book locations with anyone_can_book = true
          console.log("User is not admin, filtering by anyone_can_book");
          filteredLocations = (data || []).filter(location => location.anyone_can_book === true);
        }
        
        console.log("Available locations after filtering:", filteredLocations.length);
        setLocations(filteredLocations);
      } catch (error) {
        console.error("Error fetching locations:", error);
        toast({
          title: "Error",
          description: "Failed to load meeting rooms",
          variant: "destructive",
        });
      } finally {
        setIsLoadingLocations(false);
      }
    };
    
    if (open && userProfile) {
      fetchLocations();
    }
  }, [open, toast, userProfile]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user && !userId) return;
      
      // If the userProfileData prop is provided, use it instead of fetching
      if (userProfileData) {
        console.log("Using provided userProfileData:", userProfileData);
        setUserProfile(userProfileData);
        if (!isEditMode) {
          setNewEvent(prev => ({ ...prev, created_by: userProfileData.id }));
        }
        return;
      }
      
      if (profileId) {
        setUserProfile({ id: profileId });
        if (!isEditMode) {
          setNewEvent(prev => ({ ...prev, created_by: profileId }));
        }
        return;
      }
      
      try {
        setIsLoadingProfile(true);
        
        let { data, error } = { data: null, error: null };
        
        if (userId.startsWith('did:privy:')) {
          ({ data, error } = await supabase
            .from('profiles')
            .select('id, role')
            .filter('privy_id', 'eq', userId)
            .single());
        } 
        else if (user?.id) {
          ({ data, error } = await supabase
            .from('profiles')
            .select('id, role')
            .filter('auth_user_id', 'eq', user.id)
            .single());
        }
        
        if (error) {
          console.error("Error fetching user profile:", error);
          throw error;
        }
        
        if (data) {
          console.log("Found user profile:", data);
          setUserProfile(data);
          
          if (!isEditMode) {
            setNewEvent(prev => ({ ...prev, created_by: data.id }));
          }
        } else {
          toast({
            title: "Error",
            description: "User profile not found. Please complete your profile setup first.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchUserProfile();
  }, [user, userId, profileId, toast, isEditMode, userProfileData]);

  useEffect(() => {
    const fetchLocationAvailability = async () => {
      if (!newEvent.location_id) {
        setLocationAvailabilities([]);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('location_availability')
          .select('*')
          .eq('location_id', newEvent.location_id);
        
        if (error) throw error;
        
        setLocationAvailabilities(data || []);
        validateLocationAvailability(data || []);
      } catch (error) {
        console.error("Error fetching location availability:", error);
      }
    };
    
    if (newEvent.location_id) {
      fetchLocationAvailability();
    }
  }, [newEvent.location_id, newEvent.start_date, newEvent.end_date]);

  const resetForm = () => {
    const initialStartDate = getInitialStartDate();
    const initialEndDate = getInitialEndDate(initialStartDate);
    
    console.log('Resetting form with initial dates:', {
      initialStartDate,
      initialEndDate,
      timezone: 'Europe/Zurich'
    });
    
    setNewEvent({
      title: "",
      description: "",
      start_date: initialStartDate,
      end_date: initialEndDate,
      location_id: null,
      location_text: "",
      color: "#1a365d",
      is_all_day: false,
      created_by: userProfile?.id || "",
      av_needs: "",
      speakers: "",
      link: "",
      timezone: 'Europe/Zurich',
      recurring_pattern_id: null,
      is_recurring_instance: false,
      meerkat_enabled: true  // Changed from false to true to make it enabled by default
    });
    setSelectedTags([]);
    setAvailabilityValidationError(null);
    setUseCustomLocation(false);
    setMeerkatUrl(null);
    setOverlapValidationError(null);
  };

  const validateLocationAvailability = (availabilities: Availability[]) => {
    if (!newEvent.location_id || availabilities.length === 0) {
      setAvailabilityValidationError(null);
      return true;
    }
    
    const eventStart = new Date(newEvent.start_date);
    const eventEnd = new Date(newEvent.end_date);
    
    const conflicts = availabilities.filter(period => {
      if (period.is_available) return false;
      
      const periodStart = new Date(period.start_time);
      const periodEnd = new Date(period.end_time);
      
      return (
        (eventStart >= periodStart && eventStart < periodEnd) ||
        (eventEnd > periodStart && eventEnd <= periodEnd) ||
        (eventStart <= periodStart && eventEnd >= periodEnd)
      );
    });
    
    if (conflicts.length > 0) {
      setAvailabilityValidationError("Selected location is not available during this time period");
      return false;
    } else {
      setAvailabilityValidationError(null);
      return true;
    }
  };

  const checkForEventOverlap = async () => {
    if (!newEvent.location_id) {
      setOverlapValidationError(null);
      return true;
    }
    const start = new Date(newEvent.start_date);
    const end = new Date(newEvent.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setOverlapValidationError(null);
      return true;
    }
    let query = supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .eq('location_id', newEvent.location_id);

    if (isEditMode && event) {
      query = query.neq('id', event.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error checking overlaps:", error);
      setOverlapValidationError("Error checking overlapping events");
      return false;
    }
    
    const overlaps = (data || []).find((e) => {
      return (
        new Date(e.start_date) < end &&
        new Date(e.end_date) > start
      );
    });
    
    if (overlaps) {
      setOverlapValidationError(
        `Room already booked for this time (conflict with "${overlaps.title}")`
      );
      return false;
    }
    
    setOverlapValidationError(null);
    return true;
  };

  useEffect(() => {
    if (newEvent.location_id && newEvent.start_date && newEvent.end_date) {
      checkForEventOverlap();
    } else {
      setOverlapValidationError(null);
    }
  }, [newEvent.location_id, newEvent.start_date, newEvent.end_date, isEditMode, event]);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Allow empty URLs
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreateMeerkatEvent = async (eventId: string) => {
    try {
      setIsCreatingMeerkatEvent(true);
      
      const { data, error } = await supabase.functions.invoke('create-meerkat-event', {
        body: { eventId }
      });
      
      if (error) {
        throw new Error(`Failed to create Meerkat event: ${error.message}`);
      }
      
      if (data.success) {
        setMeerkatUrl(data.meerkatUrl);
        toast({
          title: "Meerkat Q&A created",
          description: "Successfully created Q&A session for this event",
        });
        return data.meerkatUrl;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error creating Meerkat event:', error);
      toast({
        title: "Error",
        description: `Failed to create Meerkat Q&A: ${error.message}`,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingMeerkatEvent(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      console.log('Start of form submission, current form values:', {
        title: newEvent.title,
        start_date: newEvent.start_date,
        end_date: newEvent.end_date,
        timezone: newEvent.timezone,
        browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      if (!newEvent.title) {
        toast({
          title: "Error",
          description: "Event title is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (useCustomLocation && !newEvent.location_text) {
        toast({
          title: "Error",
          description: "Please enter a custom location",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!useCustomLocation && !newEvent.location_id) {
        toast({
          title: "Error",
          description: "Please select a location",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (newEvent.link && !validateUrl(newEvent.link)) {
        toast({
          title: "Error",
          description: "Please enter a valid URL",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!userProfile?.id && !isEditMode) {
        toast({
          title: "Error",
          description: "User profile not found. Please complete your profile setup.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const startDate = new Date(newEvent.start_date);
      const endDate = new Date(newEvent.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        toast({
          title: "Error",
          description: "Invalid date format",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (startDate > endDate) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!validateLocationAvailability(locationAvailabilities)) {
        toast({
          title: "Error",
          description: availabilityValidationError || "Location is not available during selected time",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!await checkForEventOverlap()) {
        toast({
          title: "Room is already booked",
          description: overlapValidationError || "There is an overlapping event for this room.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      console.log('Before UTC conversion:', {
        start_date: newEvent.start_date,
        end_date: newEvent.end_date,
        timezone: newEvent.timezone
      });
      
      const utcStartDate = convertToUTC(newEvent.start_date, newEvent.timezone);
      const utcEndDate = convertToUTC(newEvent.end_date, newEvent.timezone);
      
      console.log('After UTC conversion:', {
        utcStartDate,
        utcEndDate,
        originalTimezone: newEvent.timezone
      });

      const eventData = {
        title: newEvent.title,
        description: newEvent.description || null,
        start_date: utcStartDate,
        end_date: utcEndDate,
        location_id: useCustomLocation ? null : newEvent.location_id,
        location_text: useCustomLocation ? newEvent.location_text : null,
        color: "#1a365d",
        is_all_day: newEvent.is_all_day,
        av_needs: newEvent.av_needs || null,
        speakers: newEvent.speakers || null,
        link: newEvent.link || null,
        timezone: newEvent.timezone,
        recurring_pattern_id: newEvent.recurring_pattern_id,
        is_recurring_instance: false,
        meerkat_enabled: newEvent.meerkat_enabled
      };

      console.log('Event data prepared for database:', eventData);

      let eventId = "";
      let meerkatUrlToSave = null;

      if (isEditMode) {
        console.log("Updating event:", event.id);
        const { data, error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id)
          .select();

        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
        
        eventId = event.id;
        
        // Handle tag updates for existing event
        if (selectedTags.length > 0) {
          await supabase
            .from('event_tag_relations')
            .delete()
            .eq('event_id', event.id);

          await supabase
            .from('event_tag_relations')
            .insert(
              selectedTags.map(tag => ({
                event_id: event.id,
                tag_id: tag.id
              }))
            );
        }
      } else {
        // Create a new event
        console.log("Creating new event");
        const { data, error } = await supabase
          .from('events')
          .insert({
            ...eventData,
            created_by: userProfile?.id || "",
          })
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
        
        console.log("Event created:", data);
        eventId = data.id;
        
        // Insert tags for new event
        if (selectedTags.length > 0) {
          await supabase
            .from('event_tag_relations')
            .insert(
              selectedTags.map(tag => ({
                event_id: data.id,
                tag_id: tag.id
              }))
            );
        }
      }

      // Create Meerkat Q&A session if enabled
      if (newEvent.meerkat_enabled && !meerkatUrl) {
        meerkatUrlToSave = await handleCreateMeerkatEvent(eventId);
      }

      toast({
        title: isEditMode ? "Event updated" : "Event created",
        description: isEditMode 
          ? "Your event has been updated successfully"
          : "Your event has been created successfully",
      });
      
      // Now properly log and pass the eventId to the parent component
      console.log("Event operation completed successfully. EventId:", eventId);
      
      onOpenChange(false);
      
      // Make sure we have a valid eventId before calling onSuccess
      if (eventId) {
        onSuccess(eventId);
      } else {
        console.error("No valid eventId returned after event creation/update");
      }
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: `Failed to save event: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;
    
    const currentDate = type === 'start' 
      ? parseISO(newEvent.start_date)
      : parseISO(newEvent.end_date);
    
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    
    const newDate = new Date(date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    
    console.log(`handleDateChange (${type}):`, {
      date: date.toString(),
      currentDate: currentDate.toString(),
      hours,
      minutes,
      newDate: newDate.toString()
    });
    
    if (type === 'start') {
      const newStartDate = format(newDate, 'yyyy-MM-dd\'T\'HH:mm:ss');
      console.log('Setting new start date:', newStartDate);
      setNewEvent(prev => ({
        ...prev,
        start_date: newStartDate,
        end_date: format(addHours(newDate, 1), 'yyyy-MM-dd\'T\'HH:mm:ss')
      }));
    } else {
      const newEndDate = format(newDate, 'yyyy-MM-dd\'T\'HH:mm:ss');
      console.log('Setting new end date:', newEndDate);
      setNewEvent(prev => ({
        ...prev,
        end_date: newEndDate
      }));
    }
  };

  const handleTimeChange = (type: 'start' | 'end', timeString: string) => {
    console.log(`handleTimeChange (${type}):`, { timeString });
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const currentDate = type === 'start' 
      ? parseISO(newEvent.start_date) 
      : parseISO(newEvent.end_date);
    
    const newDate = new Date(currentDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);

    console.log('After setting hours/minutes:', {
      newDate: newDate.toString(),
      newDateISO: newDate.toISOString(),
      timezone: newEvent.timezone
    });
    
    if (type === 'start') {
      const newStartDate = format(newDate, 'yyyy-MM-dd\'T\'HH:mm:ss');
      console.log('Setting new time-adjusted start date:', newStartDate);
      setNewEvent(prev => ({
        ...prev,
        start_date: newStartDate,
        end_date: format(addHours(newDate, 1), 'yyyy-MM-dd\'T\'HH:mm:ss')
      }));
    } else {
      const newEndDate = format(newDate, 'yyyy-MM-dd\'T\'HH:mm:ss');
      console.log('Setting new time-adjusted end date:', newEndDate);
      setNewEvent(prev => ({
        ...prev,
        end_date: newEndDate
      }));
    }
  };

  const handleLocationChange = (locationId: string) => {
    setNewEvent({
      ...newEvent,
      location_id: locationId,
      location_text: null
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Event" : "Create Event"}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Update the details of your event."
              : "Add a new event to your calendar."}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input 
                id="title" 
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="Team Meeting"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Details about the event..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-all-day"
                checked={newEvent.is_all_day}
                onCheckedChange={(checked) => setNewEvent({...newEvent, is_all_day: checked})}
              />
              <Label htmlFor="is-all-day">All day event</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEvent.start_date ? format(parseISO(newEvent.start_date), 'MMM d, yyyy') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newEvent.start_date ? parseISO(newEvent.start_date) : undefined}
                      onSelect={(date) => handleDateChange('start', date)}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!newEvent.is_all_day && (
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <Input 
                      id="start-time" 
                      type="time"
                      value={format(parseISO(newEvent.start_date), 'HH:mm')}
                      onChange={(e) => handleTimeChange('start', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEvent.end_date ? format(parseISO(newEvent.end_date), 'MMM d, yyyy') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newEvent.end_date ? parseISO(newEvent.end_date) : undefined}
                      onSelect={(date) => handleDateChange('end', date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!newEvent.is_all_day && (
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <Input 
                      id="end-time" 
                      type="time"
                      value={format(parseISO(newEvent.end_date), 'HH:mm')}
                      onChange={(e) => handleTimeChange('end', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={newEvent.timezone} 
                onValueChange={(value) => setNewEvent({...newEvent, timezone: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_ZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Location</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="custom-location" className="text-sm text-muted-foreground">
                    Use custom location
                  </Label>
                  <Switch 
                    id="custom-location" 
                    checked={useCustomLocation} 
                    onCheckedChange={setUseCustomLocation} 
                  />
                </div>
              </div>
              
              {useCustomLocation ? (
                <Input 
                  placeholder="Custom location (e.g., Online, Café, etc.)" 
                  value={newEvent.location_text || ''} 
                  onChange={(e) => setNewEvent({...newEvent, location_text: e.target.value})}
                />
              ) : (
                <div className="space-y-2">
                  <Select value={newEvent.location_id || ''} onValueChange={handleLocationChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingLocations ? (
                        <div className="flex justify-center p-2">
                          <Spinner size="sm" />
                        </div>
                      ) : (
                        locations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} {location.building && `(${location.building}${location.floor ? `, Floor ${location.floor}` : ''})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  
                  {availabilityValidationError && (
                    <p className="text-sm text-red-500">{availabilityValidationError}</p>
                  )}
                  
                  {overlapValidationError && (
                    <p className="text-sm text-red-500">{overlapValidationError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Event Tags</Label>
              <TagSelector 
                selectedTags={selectedTags} 
                onTagsChange={setSelectedTags} 
              />
            </div>

            <div className="space-y-2">
              <Label>Event URL (Optional)</Label>
              <div className="flex items-center space-x-2">
                <Link className="h-4 w-4 text-gray-500" />
                <Input 
                  value={newEvent.link || ''}
                  onChange={(e) => setNewEvent({...newEvent, link: e.target.value})}
                  placeholder="https://example.com/meeting"
                />
              </div>
              {newEvent.link && !validateUrl(newEvent.link) && (
                <p className="text-sm text-red-500">Please enter a valid URL</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>List of Speakers</Label>
              <Textarea 
                value={newEvent.speakers || ''}
                onChange={(e) => setNewEvent({...newEvent, speakers: e.target.value})}
                placeholder="Names of speakers (if applicable)"
                rows={2}
              />
            </div>
            
            {/* AV Needs notice instead of field */}
            <div className="space-y-2">
              <Label className="font-semibold text-amber-600">TALK TO MEDIA TEAM 24 HOURS IN ADVANCE TO COORDINATE A/V NEEDS</Label>
            </div>

            {/* Meerkat Q&A Toggle Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="meerkat-toggle" className="text-md font-medium">
                    Add Meerkat Q&A Session
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable interactive Q&A for your event
                  </p>
                </div>
                <Switch 
                  id="meerkat-toggle" 
                  checked={newEvent.meerkat_enabled} 
                  onCheckedChange={(checked) => setNewEvent({...newEvent, meerkat_enabled: checked})} 
                />
              </div>
              
              {newEvent.meerkat_enabled && (
                <div>
                  {isCreatingMeerkatEvent ? (
                    <div className="flex items-center space-x-2 text-blue-500">
                      <Spinner size="xs" className="border-current border-r-transparent" />
                      <span>Creating Meerkat Q&A session...</span>
                    </div>
                  ) : meerkatUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-green-500">
                        <MessageSquare className="h-4 w-4" />
                        <span>Meerkat Q&A session created!</span>
                      </div>
                      <Input 
                        value={meerkatUrl}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  ) : isEditMode ? (
                    <div className="flex items-center space-x-2 text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Q&A session will be created when you save</span>
                    </div>
                  ) : null}
                  
                  <p className="mt-2 text-xs text-muted-foreground">
                    This will create a Meerkat Q&A session for your event, enabling participants to ask questions and interact during the session.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    {isEditMode ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  isEditMode ? "Save Changes" : "Create Event"
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
