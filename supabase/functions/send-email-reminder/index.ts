
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface EmailReminderRequest {
  invoiceId: string;
  email: string;
  firstName: string;
  lastName: string;
  invoiceAmount: number;
  dueDate: string;
  paymentLink: string;
  isNewBooking?: boolean; // Added to differentiate between new bookings and reminders
  reminderType?: 'payment' | 'housing'; // Added to differentiate between payment and housing reminders
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, email, firstName, lastName, invoiceAmount, dueDate, paymentLink, isNewBooking, reminderType = 'payment' } = 
      await req.json() as EmailReminderRequest;

    if (!invoiceId || !email) {
      throw new Error('Missing required fields: invoiceId and email are required');
    }

    // Get Mailchimp API key from environment
    const apiKey = Deno.env.get("MAILCHIMP_API_KEY");
    if (!apiKey) {
      throw new Error('Mailchimp API key not configured');
    }

    // Setup recipients list with the specified format
    const recipients = [
      {
        email: email,
        name: firstName,
        type: "to"
      },
      {
        email: "team@zuitzerland.ch",
        name: "Zuitzerland Team",
        type: "bcc"
      },
      {
        email: "isla@zuitzerland.ch",
        name: "Isla from Zuitzerland",
        type: "bcc"
      }
    ];

    // Determine the subject based on the type of email being sent
    let subject, templateName;
    
    if (isNewBooking) {
      subject = "Your Zuitzerland Booking Confirmation";
      templateName = "lock-it-in";
    } else if (reminderType === 'housing') {
      subject = "Complete Your Housing Preferences for Zuitzerland";
      templateName = "housing-preferences";
    } else {
      // Default to payment reminder
      subject = "Reminder to Pay Your Zuitzerland Invoice";
      templateName = "lock-it-in";
    }

    // Prepare the data for Mailchimp API with the specified structure
    const mailchimpData = {
      key: apiKey,
      template_name: templateName,
      template_content: [], // For transactional emails, this is often empty
      message: {
        to: recipients,
        from_email: "team@zuitzerland.ch", // Updated as requested
        from_name: "The Zuitzerland Team", // Updated as requested
        subject: subject,
        merge_language: "mailchimp",
        global_merge_vars: [
          { 
            name: "INVOICE", 
            content: paymentLink // Using the payment link as the invoice link
          },
          {
            name: "FNAME",
            content: firstName // Adding first name as requested
          }
        ],
        headers: {
          "Reply-To": "team@zuitzerland.ch"
        }
      }
    };

    const emailType = isNewBooking 
      ? "booking confirmation" 
      : reminderType === 'housing'
        ? "housing preferences reminder"
        : "payment reminder";
    
    console.log(`Sending ${emailType} email to:`, email);
    
    // Call Mailchimp Transactional API (Mandrill)
    const response = await fetch('https://mandrillapp.com/api/1.0/messages/send-template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailchimpData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Mailchimp API error:', errorData);
      throw new Error(`Mailchimp API responded with ${response.status}: ${errorData}`);
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);

    // Only update reminder count and timestamp if this is a reminder (not a new booking)
    if (!isNewBooking) {
      // Update the invoice in database to mark that a reminder was sent
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.7");
      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // First, increment the reminder count
      const { data: newCount, error: rpcError } = await supabase
        .rpc('increment_reminder_count', { invoice_id: invoiceId });

      if (rpcError) {
        console.error('Error incrementing reminder count:', rpcError);
        throw new Error('Failed to increment reminder count');
      }

      // Then, update the last_reminder_sent timestamp and the reminder_count
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          last_reminder_sent: new Date().toISOString(),
          reminder_count: newCount
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error updating invoice reminder status:', updateError);
        throw new Error('Failed to update invoice reminder status');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${emailType} email sent successfully`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-email-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
