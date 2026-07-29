import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Mail, MessageSquare, Send, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface ReviewRequestCustomerDetails {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  projectName: string;
}

interface ReviewRequestProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  projectName?: string;
  /**
   * Public review-gate link included in the default message. When absent, a
   * "[review link]" placeholder is shown instead and the caller is expected to
   * substitute the real link before delivering the message (e.g. after
   * creating the review_requests row).
   */
  reviewLink?: string;
  /** Render the customer fields as inputs (new-request flow with no row yet). */
  editableCustomer?: boolean;
  onSend: (
    method: "sms" | "email" | "both",
    message: string,
    details: ReviewRequestCustomerDetails,
  ) => void;
}

export function ReviewRequest({
  isOpen,
  onClose,
  customerName,
  customerEmail,
  customerPhone,
  projectName,
  reviewLink,
  editableCustomer = false,
  onSend,
}: ReviewRequestProps) {
  const [selectedMethod, setSelectedMethod] = useState<
    "sms" | "email" | "both"
  >("both");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(customerName ?? "");
  const [phone, setPhone] = useState(customerPhone ?? "");
  const [email, setEmail] = useState(customerEmail ?? "");
  const [project, setProject] = useState(projectName ?? "");

  // Re-seed the customer fields each time the dialog opens for a new target
  useEffect(() => {
    if (isOpen) {
      setName(customerName ?? "");
      setPhone(customerPhone ?? "");
      setEmail(customerEmail ?? "");
      setProject(projectName ?? "");
    }
  }, [isOpen, customerName, customerEmail, customerPhone, projectName]);

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();
  const displayName = trimmedName || "Customer";
  const displayProject = project.trim() || "recent";

  const defaultMessage = `Hi ${displayName}! We've completed your ${displayProject} project. We'd greatly appreciate if you could leave us a review. Here's the link: ${reviewLink ?? "[review link]"}`;

  const handleSend = () => {
    const messageToSend = useCustomMessage ? customMessage : defaultMessage;

    if (!messageToSend.trim()) {
      toast.error("Please enter a message to send");
      return;
    }

    if (editableCustomer && !trimmedName) {
      toast.error("Please enter the customer's name");
      return;
    }

    if (selectedMethod === "email" && !trimmedEmail) {
      toast.error("Customer email is required for email requests");
      return;
    }

    if (selectedMethod === "sms" && !trimmedPhone) {
      toast.error("Customer phone number is required for SMS requests");
      return;
    }

    if (selectedMethod === "both" && (!trimmedEmail || !trimmedPhone)) {
      toast.error(
        "Both email and phone number are required for combined sending",
      );
      return;
    }

    onSend(selectedMethod, messageToSend, {
      customerName: displayName,
      customerPhone: trimmedPhone,
      customerEmail: trimmedEmail,
      projectName: project.trim(),
    });
    onClose();
  };

  const copyMessage = () => {
    const messageToCopy = useCustomMessage ? customMessage : defaultMessage;
    navigator.clipboard.writeText(messageToCopy);
    setCopied(true);
    toast.success("Message copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMethodChange = (method: "sms" | "email" | "both") => {
    setSelectedMethod(method);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Request Google Review
          </DialogTitle>
          <DialogDescription>
            Send a review request to your customer via SMS, email, or both
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editableCustomer ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor="rr-customer-name"
                      className="text-xs text-muted-foreground"
                    >
                      Name
                    </Label>
                    <Input
                      id="rr-customer-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="rr-project-name"
                      className="text-xs text-muted-foreground"
                    >
                      Project
                    </Label>
                    <Input
                      id="rr-project-name"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      placeholder="Project name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="rr-customer-phone"
                      className="text-xs text-muted-foreground"
                    >
                      Phone
                    </Label>
                    <Input
                      id="rr-customer-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="rr-customer-email"
                      className="text-xs text-muted-foreground"
                    >
                      Email
                    </Label>
                    <Input
                      id="rr-customer-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@email.com"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="font-medium">{displayName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Project
                    </Label>
                    <p className="font-medium">{project || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p
                      className={
                        trimmedPhone ? "font-medium" : "text-muted-foreground"
                      }
                    >
                      {trimmedPhone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p
                      className={
                        trimmedEmail ? "font-medium" : "text-muted-foreground"
                      }
                    >
                      {trimmedEmail || "Not provided"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Method */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Delivery Method</Label>
            <div className="grid grid-cols-3 gap-3">
              <Card
                className={`cursor-pointer transition-colors ${selectedMethod === "sms" ? "ring-2 ring-primary" : ""}`}
                onClick={() => handleMethodChange("sms")}
              >
                <CardContent className="p-4 text-center">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="font-medium text-sm">SMS Only</p>
                  <p className="text-xs text-muted-foreground">Text message</p>
                  {!trimmedPhone && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      No phone
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${selectedMethod === "email" ? "ring-2 ring-primary" : ""}`}
                onClick={() => handleMethodChange("email")}
              >
                <CardContent className="p-4 text-center">
                  <Mail className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="font-medium text-sm">Email Only</p>
                  <p className="text-xs text-muted-foreground">Email message</p>
                  {!trimmedEmail && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      No email
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${selectedMethod === "both" ? "ring-2 ring-primary" : ""}`}
                onClick={() => handleMethodChange("both")}
              >
                <CardContent className="p-4 text-center">
                  <Send className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="font-medium text-sm">Both</p>
                  <p className="text-xs text-muted-foreground">SMS + Email</p>
                  {(!trimmedEmail || !trimmedPhone) && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      Missing info
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Message Content */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="custom-message"
                checked={useCustomMessage}
                onCheckedChange={(checked) => setUseCustomMessage(checked === true)}
              />
              <Label htmlFor="custom-message" className="text-sm font-medium">
                Use custom message
              </Label>
            </div>

            {useCustomMessage ? (
              <div className="space-y-2">
                <Label className="text-sm">Custom Message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter your custom review request message..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Default Message</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMessage}
                    className="h-8 gap-2"
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {defaultMessage}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              (selectedMethod === "email" && !trimmedEmail) ||
              (selectedMethod === "sms" && !trimmedPhone) ||
              (selectedMethod === "both" && (!trimmedEmail || !trimmedPhone))
            }
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send Review Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
