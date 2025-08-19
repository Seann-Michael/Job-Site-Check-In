import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Info, 
  Upload, 
  Copy, 
  QrCode, 
  Mail, 
  Clock, 
  CheckCircle,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import {
  OnboardingLinkForm,
  OnboardingFormErrors,
  GeneratedLink,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DESCRIPTIONS,
  AccessLevel,
  CustomPlatform
} from '../../types/oauth';
import { CustomPlatformManager } from './CustomPlatformManager';

interface OnboardingLinkGeneratorProps {
  onLinkGenerated?: (link: GeneratedLink, sessionId: string) => void;
}

export const OnboardingLinkGenerator: React.FC<OnboardingLinkGeneratorProps> = ({
  onLinkGenerated
}) => {
  const [form, setForm] = useState<OnboardingLinkForm>({
    client_name: '',
    client_email: '',
    client_company: '',
    selected_platforms: [],
    selected_custom_platforms: [],
    access_level: 'read_only',
    branding: {
      primary_color: '#2563eb',
      company_name: '',
      logo_url: undefined
    }
  });

  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatform[]>([]);
  const [showCustomPlatformManager, setShowCustomPlatformManager] = useState(false);

  const [errors, setErrors] = useState<OnboardingFormErrors>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: OnboardingFormErrors = {};

    if (!form.client_name.trim() || form.client_name.length < 2) {
      newErrors.client_name = 'Client name is required (minimum 2 characters)';
    }

    if (!form.client_email.trim()) {
      newErrors.client_email = 'Client email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) {
      newErrors.client_email = 'Please enter a valid email address';
    }

    if (form.selected_platforms.length === 0) {
      newErrors.selected_platforms = 'Please select at least one platform';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlatformToggle = (platform: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      selected_platforms: checked 
        ? [...prev.selected_platforms, platform]
        : prev.selected_platforms.filter(p => p !== platform)
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, branding: 'Logo file size must be less than 2MB' }));
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.type)) {
      setErrors(prev => ({ ...prev, branding: 'Logo must be JPG, PNG, or SVG format' }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      setForm(prev => ({
        ...prev,
        branding: {
          ...prev.branding,
          logo_url: result
        }
      }));
    };
    reader.readAsDataURL(file);

    // Clear any previous errors
    setErrors(prev => ({ ...prev, branding: undefined }));
  };

  const generateLink = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/oauth/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error('Failed to generate onboarding link');
      }

      const data = await response.json();
      const link: GeneratedLink = {
        url: `${window.location.origin}/onboard/${data.session.onboarding_token}`,
        token: data.session.onboarding_token,
        expires_at: data.session.expires_at,
        qr_code: data.qr_code
      };

      setGeneratedLink(link);
      onLinkGenerated?.(link, data.session.id);
    } catch (error) {
      console.error('Error generating link:', error);
      setErrors({ client_name: 'Failed to generate link. Please try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const sendEmailInvite = () => {
    const subject = encodeURIComponent(`Complete Your Platform Onboarding - ${form.branding.company_name || 'Your Agency'}`);
    const body = encodeURIComponent(
      `Hi ${form.client_name},\n\n` +
      `Please complete your platform onboarding by clicking the link below:\n\n` +
      `${generatedLink?.url}\n\n` +
      `This link will expire in 7 days.\n\n` +
      `Best regards,\n${form.branding.company_name || 'Your Agency'}`
    );
    
    window.open(`mailto:${form.client_email}?subject=${subject}&body=${body}`);
  };

  const resetForm = () => {
    setForm({
      client_name: '',
      client_email: '',
      client_company: '',
      selected_platforms: [],
      access_level: 'read_only',
      branding: {
        primary_color: '#2563eb',
        company_name: '',
        logo_url: undefined
      }
    });
    setErrors({});
    setGeneratedLink(null);
    setLogoPreview(null);
  };

  if (generatedLink) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Onboarding Link Generated Successfully
          </CardTitle>
          <CardDescription>
            Share this link with {form.client_name} to complete their platform connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generated Link */}
          <div className="space-y-2">
            <Label>Onboarding Link</Label>
            <div className="flex gap-2">
              <Input 
                value={generatedLink.url} 
                readOnly 
                className="flex-1 font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(generatedLink.url)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(generatedLink.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Expiration Info */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              This link will expire on {new Date(generatedLink.expires_at).toLocaleDateString()} at{' '}
              {new Date(generatedLink.expires_at).toLocaleTimeString()}
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={sendEmailInvite} className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Send Email Invite
            </Button>
            {generatedLink.qr_code && (
              <Button variant="outline" className="flex-1">
                <QrCode className="h-4 w-4 mr-2" />
                Show QR Code
              </Button>
            )}
            <Button variant="outline" onClick={resetForm} className="flex-1">
              Generate Another Link
            </Button>
          </div>

          {/* Selected Platforms Preview */}
          <div className="space-y-2">
            <Label>Selected Platforms ({form.selected_platforms.length})</Label>
            <div className="flex flex-wrap gap-2">
              {form.selected_platforms.map(platform => (
                <Badge key={platform} variant="secondary">
                  {PLATFORM_DISPLAY_NAMES[platform as keyof typeof PLATFORM_DISPLAY_NAMES]}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Generate Client Onboarding Link
          <Info className="h-5 w-5 text-muted-foreground cursor-help" title="Create a branded link for clients to connect their marketing platforms" />
        </CardTitle>
        <CardDescription>
          Create a customized onboarding experience for your clients to securely connect their marketing platforms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Client Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Client Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={form.client_name}
                onChange={(e) => setForm(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="John Smith"
                className={errors.client_name ? 'border-red-500' : ''}
              />
              {errors.client_name && (
                <p className="text-sm text-red-500">{errors.client_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Client Email *</Label>
              <Input
                id="client_email"
                type="email"
                value={form.client_email}
                onChange={(e) => setForm(prev => ({ ...prev, client_email: e.target.value }))}
                placeholder="john@company.com"
                className={errors.client_email ? 'border-red-500' : ''}
              />
              {errors.client_email && (
                <p className="text-sm text-red-500">{errors.client_email}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_company">Company Name (Optional)</Label>
            <Input
              id="client_company"
              value={form.client_company}
              onChange={(e) => setForm(prev => ({ ...prev, client_company: e.target.value }))}
              placeholder="Acme Corporation"
            />
          </div>
        </div>

        {/* Platform Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Platform Selection</h3>
            {errors.selected_platforms && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.selected_platforms}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUPPORTED_PLATFORMS.map(platform => (
              <div key={platform} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <Checkbox
                  id={platform}
                  checked={form.selected_platforms.includes(platform)}
                  onCheckedChange={(checked) => handlePlatformToggle(platform, checked as boolean)}
                />
                <div className="flex-1 space-y-1">
                  <Label htmlFor={platform} className="font-medium cursor-pointer">
                    {PLATFORM_DISPLAY_NAMES[platform as keyof typeof PLATFORM_DISPLAY_NAMES]}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {PLATFORM_DESCRIPTIONS[platform as keyof typeof PLATFORM_DESCRIPTIONS]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Access Level Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Access Level Configuration</h3>
          <RadioGroup 
            value={form.access_level} 
            onValueChange={(value: AccessLevel) => setForm(prev => ({ ...prev, access_level: value }))}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="read_only" id="read_only" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="read_only" className="font-medium cursor-pointer">
                  Read Only Access
                </Label>
                <p className="text-sm text-muted-foreground">
                  View data and reports only. Cannot make changes to campaigns or settings.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="full_management" id="full_management" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="full_management" className="font-medium cursor-pointer">
                  Full Management Access
                </Label>
                <p className="text-sm text-muted-foreground">
                  Complete access to view, edit, and manage all campaigns and settings.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Branding Customization */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Branding Customization</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo_upload">Company Logo</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="logo_upload"
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('logo_upload')?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Logo
                  </Button>
                  {logoPreview && (
                    <div className="w-12 h-12 border rounded overflow-hidden">
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Max 2MB. Supports JPG, PNG, SVG formats.
                </p>
                {errors.branding && (
                  <p className="text-sm text-red-500">{errors.branding}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name for Branding</Label>
                <Input
                  id="company_name"
                  value={form.branding.company_name}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    branding: { ...prev.branding, company_name: e.target.value }
                  }))}
                  placeholder="Your Agency Name"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={form.branding.primary_color}
                    onChange={(e) => setForm(prev => ({
                      ...prev,
                      branding: { ...prev.branding, primary_color: e.target.value }
                    }))}
                    className="w-16 h-10 p-1 rounded"
                  />
                  <Input
                    value={form.branding.primary_color}
                    onChange={(e) => setForm(prev => ({
                      ...prev,
                      branding: { ...prev.branding, primary_color: e.target.value }
                    }))}
                    placeholder="#2563eb"
                    className="font-mono"
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div 
                  className="p-4 rounded-lg border text-white text-center font-medium"
                  style={{ backgroundColor: form.branding.primary_color }}
                >
                  {form.branding.company_name || 'Your Agency'} Onboarding
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateLink} 
          disabled={isGenerating}
          className="w-full h-12 text-lg"
          style={{ backgroundColor: form.branding.primary_color }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Onboarding Link...
            </>
          ) : (
            'Generate Onboarding Link'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OnboardingLinkGenerator;
