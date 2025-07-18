
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 200 // Ensure we return 200 OK for preflight requests
    });
  }

  try {
    const requestFinanceApiKey = Deno.env.get('REQUEST_FINANCE_API_KEY');
    
    if (!requestFinanceApiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { invoiceNumber } = await req.json();
    
    if (!invoiceNumber) {
      return new Response(
        JSON.stringify({ error: 'Invoice number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching for invoice with number: ${invoiceNumber}`);
    
    // Search for the invoice in Request Finance
    const searchUrl = `https://api.request.finance/invoices?search=${encodeURIComponent(invoiceNumber)}&withLinks=true`;
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': requestFinanceApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Request Finance API error:', errorText);
      return new Response(
        JSON.stringify({ error: `API request failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoices = await response.json();
    console.log(`Found ${invoices.length} invoices`);

    // Find the exact invoice matching the requested number
    const targetInvoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    
    if (!targetInvoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found', invoicesCount: invoices.length }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get detailed invoice information including events history
    const detailUrl = `https://api.request.finance/invoices/${targetInvoice.id}`;
    const detailResponse = await fetch(detailUrl, {
      method: 'GET',
      headers: {
        'Authorization': requestFinanceApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!detailResponse.ok) {
      const errorText = await detailResponse.text();
      console.error('Request Finance API error when fetching details:', errorText);
      // Fall back to the less detailed invoice data
      return new Response(
        JSON.stringify({ 
          success: true, 
          invoice: targetInvoice,
          invoiceLinks: targetInvoice.invoiceLinks || {}
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detailedInvoice = await detailResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice: detailedInvoice,
        invoiceLinks: detailedInvoice.invoiceLinks || targetInvoice.invoiceLinks || {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-request-finance-invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
