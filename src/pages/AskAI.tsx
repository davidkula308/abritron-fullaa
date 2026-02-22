import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useArbitron, type ChatMessage } from "@/hooks/useArbitron";
import { useTradingAccounts } from "@/hooks/useTradingAccounts";
import ReactMarkdown from "react-markdown";
import AIPositionsMonitor from "@/components/AIPositionsMonitor";

const AskAI = () => {
  const { accounts } = useTradingAccounts();

  // Default to first non-live (demo) account, preferring IC Markets
  const getDefaultAccountId = () => {
    const icDemo = accounts.find(a => !a.is_live && a.broker_name?.toLowerCase().includes("ic markets"));
    if (icDemo) return icDemo.id;
    const anyDemo = accounts.find(a => !a.is_live);
    if (anyDemo) return anyDemo.id;
    return accounts[0]?.id || "";
  };

  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Set default once accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(getDefaultAccountId());
    }
  }, [accounts]);

  const { messages, isLoading, sendMessage, clearChat } = useArbitron(selectedAccountId);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Voice output for assistant messages — cancel on new user input (interrupt)
  useEffect(() => {
    if (!voiceEnabled || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      speechSynthesis.cancel();
      return;
    }
    if (last.role === 'assistant' && !isLoading) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(last.content.replace(/```[\s\S]*?```/g, '').replace(/[#*_`]/g, ''));
      utterance.rate = 1.1;
      utterance.pitch = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, [messages, isLoading, voiceEnabled]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    speechSynthesis.cancel();
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      if (event.results[0]?.isFinal) {
        setIsListening(false);
        if (transcript.trim()) {
          setInput("");
          sendMessage(transcript.trim());
        }
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="min-h-screen pb-20 bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 box-glow">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-cyber text-lg font-bold tracking-wider">
                ARBITRON <span className="text-primary">AI</span>
              </h1>
              <p className="text-xs text-muted-foreground">Your AI trading assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {voiceEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
            </div>
            <Button variant="ghost" size="icon" onClick={clearChat}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Account Selector */}
        {accounts.length > 0 && (
          <div className="mt-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select trading account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.broker_name || 'Account'} ({acc.is_live ? 'Live' : 'Demo'}) — {acc.currency} {acc.balance != null ? acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Positions Monitor */}
      {selectedAccountId && (() => {
        const acc = accounts.find(a => a.id === selectedAccountId);
        return acc ? <AIPositionsMonitor accountId={acc.account_id} accountDbId={acc.id} /> : null;
      })()}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center box-glow">
              <Bot className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-cyber text-lg font-semibold mb-2">Hey, I'm Arbitron</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
              Your AI trading assistant. Ask me to analyze pairs, find entries, or execute trades.
            </p>
            <div className="space-y-2 max-w-xs mx-auto">
              {[
                "Analyze XAUUSD on 15min timeframe",
                "Find entry for EURUSD with SL and TP",
                "What are my open positions?",
                "Draw support and resistance for NAS100",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full text-left text-xs p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card border border-border rounded-bl-sm"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-primary [&_pre]:bg-secondary [&_pre]:rounded-lg [&_pre]:p-3">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-16 bg-background border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <Button
            variant={isListening ? "default" : "outline"}
            size="icon"
            onClick={toggleListening}
            className={cn(isListening && "animate-pulse-glow")}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Arbitron anything..."
            className="min-h-[40px] max-h-[120px] resize-none bg-card border-border"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AskAI;
