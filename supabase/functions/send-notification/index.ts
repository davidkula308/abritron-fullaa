 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { Resend } from "https://esm.sh/resend@2.0.0";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface NotificationRequest {
   email: string;
   subject: string;
   message: string;
   type: "app_closed" | "trade_signal" | "bot_status" | "vps_status";
 }
 
 const handler = async (req: Request): Promise<Response> => {
   // Handle CORS preflight requests
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const resendApiKey = Deno.env.get("RESEND_API_KEY");
     
     if (!resendApiKey) {
       console.log("RESEND_API_KEY not configured - notification skipped");
       return new Response(
         JSON.stringify({ success: false, message: "Email service not configured" }),
         { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     const resend = new Resend(resendApiKey);
     const { email, subject, message, type }: NotificationRequest = await req.json();
 
     // Validate required fields
     if (!email || !subject || !message) {
       throw new Error("Missing required fields: email, subject, message");
     }
 
     const emailResponse = await resend.emails.send({
       from: "ArbitronKing <noreply@lovable.app>",
       to: [email],
       subject: subject,
       html: `
         <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #ffffff;">
           <div style="text-align: center; margin-bottom: 20px;">
             <h1 style="color: #00ff88; font-size: 24px; margin: 0;">ArbitronKing</h1>
             <p style="color: #888; font-size: 12px;">Trading Automation Platform</p>
           </div>
           
           <div style="background: #252545; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
             <h2 style="color: #00ff88; margin-top: 0;">${subject}</h2>
             <p style="color: #e0e0e0; line-height: 1.6;">${message}</p>
           </div>
           
           <div style="text-align: center; color: #666; font-size: 12px;">
             <p>This is an automated notification from your ArbitronKing trading platform.</p>
             <p>Your bots are running via VPS in the background.</p>
           </div>
         </div>
       `,
     });
 
     console.log("Notification email sent:", emailResponse);
 
     return new Response(
       JSON.stringify({ success: true, id: emailResponse.data?.id }),
       { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
     );
   } catch (error: unknown) {
     console.error("Error in send-notification function:", error);
     const message = error instanceof Error ? error.message : "Unknown error";
     return new Response(
       JSON.stringify({ error: message }),
       { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
     );
   }
 };
 
 serve(handler);