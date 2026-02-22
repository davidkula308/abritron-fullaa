 import { supabase } from '@/integrations/supabase/client';
 
 export type NotificationType = "app_closed" | "trade_signal" | "bot_status" | "vps_status";
 
 interface NotificationParams {
   email: string;
   subject: string;
   message: string;
   type: NotificationType;
 }
 
 export const useNotifications = () => {
   const sendNotification = async (params: NotificationParams) => {
     const { data, error } = await supabase.functions.invoke('send-notification', {
       body: params,
     });
 
     if (error) throw error;
     return data;
   };
 
   const notifyAppClosed = async (email: string) => {
     return sendNotification({
       email,
       subject: "ArbitronKing - Running in Background via VPS",
       message: "Your app has been closed. Your trading bots are now running in the background via VPS. You will receive notifications for important trading events.",
       type: "app_closed",
     });
   };
 
   const notifyTradeSignal = async (email: string, pair: string, action: string, strategy: string) => {
     return sendNotification({
       email,
       subject: `Trade Signal: ${action} ${pair}`,
       message: `Your strategy "${strategy}" has generated a ${action} signal for ${pair}. The trade is being executed automatically.`,
       type: "trade_signal",
     });
   };
 
   const notifyBotStatus = async (email: string, botName: string, status: string) => {
     return sendNotification({
       email,
       subject: `Bot Status: ${botName}`,
       message: `Your trading bot "${botName}" status has changed to: ${status}`,
       type: "bot_status",
     });
   };
 
   return { sendNotification, notifyAppClosed, notifyTradeSignal, notifyBotStatus };
 };