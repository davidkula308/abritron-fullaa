import { useState } from "react";
import { Bot as BotIcon, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { validateBotFile, extractBotParameters, VALID_EXTENSIONS, type Bot, type BotParameter } from "@/types/bot";

interface AddBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBotAdded: (bot: Bot) => void;
}

const AddBotDialog = ({ open, onOpenChange, onBotAdded }: AddBotDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    type: "MQL5" as "MQL4" | "MQL5",
    file: null as File | null,
  });
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    
    if (!file) {
      setFormData({ ...formData, file: null });
      return;
    }

    const validation = validateBotFile(file);
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file");
      setFormData({ ...formData, file: null });
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      // Reset the input
      e.target.value = "";
      return;
    }

    // Auto-detect type from extension
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    const detectedType = ext.includes("4") ? "MQL4" : "MQL5";
    
    setFormData({
      ...formData,
      file,
      type: detectedType,
      name: formData.name || file.name.replace(/\.(mq4|mq5|ex4|ex5)$/i, ""),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.file) {
      toast({
        title: "File Required",
        description: "Please upload a valid MQL4/MQL5 Expert Advisor file",
        variant: "destructive",
      });
      return;
    }

    // Extract parameters from the bot file (async - reads file content)
    const parameters: BotParameter[] = await extractBotParameters(formData.file, formData.type);

    const newBot: Bot = {
      id: crypto.randomUUID(),
      name: formData.name,
      type: formData.type,
      status: "stopped",
      trades: 0,
      profit: 0,
      fileName: formData.file.name,
      parameters,
    };

    onBotAdded(newBot);
    onOpenChange(false);
    setFormData({ name: "", type: "MQL5", file: null });
    setFileError(null);

    toast({
      title: "Bot Added",
      description: `${formData.name} has been added. Configure settings before launching.`,
    });
  };

  const resetForm = () => {
    setFormData({ name: "", type: "MQL5", file: null });
    setFileError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="bg-card border-border max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="font-cyber text-lg tracking-wider flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-primary" />
            Add Trading Bot
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Upload EA File</Label>
            <div className="relative">
              <input
                type="file"
                accept={VALID_EXTENSIONS.join(",")}
                onChange={handleFileChange}
                className="hidden"
                id="bot-file"
              />
              <label
                htmlFor="bot-file"
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                  fileError 
                    ? "border-destructive bg-destructive/10" 
                    : formData.file 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-border hover:border-primary/50"
                )}
              >
                <Upload className={cn(
                  "w-6 h-6",
                  fileError ? "text-destructive" : formData.file ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm text-center",
                  fileError ? "text-destructive" : formData.file ? "text-foreground" : "text-muted-foreground"
                )}>
                  {formData.file ? formData.file.name : "Choose .mq4, .mq5, .ex4, or .ex5 file"}
                </span>
              </label>
            </div>
            {fileError && (
              <div className="flex items-center gap-2 text-destructive text-xs">
                <AlertCircle className="w-4 h-4" />
                {fileError}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Accepted formats: .mq4, .mq5, .ex4, .ex5
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-medium">
              Bot Name
            </Label>
            <Input
              id="name"
              placeholder="e.g., Gold Scalper Pro"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-secondary border-border focus:border-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Bot Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "MQL4" | "MQL5") =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MQL4">MQL4 Expert Advisor</SelectItem>
                <SelectItem value="MQL5">MQL5 Expert Advisor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full font-cyber"
            disabled={!formData.file || !formData.name}
          >
            Add Bot
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddBotDialog;
