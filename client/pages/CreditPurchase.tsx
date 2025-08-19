import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/AppLayout";
import {
  Zap,
  CreditCard,
  Star,
  Check,
  ArrowLeft,
  Calculator,
  Shield,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCredits } from "@/components/CreditProvider";
import { addCredits, formatCredits } from "@/lib/creditSystem";
import { toast } from "sonner";

// Credit packages with pricing
const creditPackages = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 10000,
    price: 29,
    pricePerCredit: 0.0029,
    popular: false,
    description: "Perfect for small businesses",
    features: ["10,000 credits", "Standard support", "30-day expiry"],
  },
  {
    id: "professional",
    name: "Professional",
    credits: 50000,
    price: 99,
    pricePerCredit: 0.00198,
    popular: true,
    description: "Most popular choice",
    features: [
      "50,000 credits",
      "Priority support",
      "60-day expiry",
      "15% savings",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 150000,
    price: 249,
    pricePerCredit: 0.00166,
    popular: false,
    description: "For large operations",
    features: [
      "150,000 credits",
      "Premium support",
      "90-day expiry",
      "30% savings",
    ],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    credits: 500000,
    price: 699,
    pricePerCredit: 0.001398,
    popular: false,
    description: "Maximum value",
    features: [
      "500,000 credits",
      "White-glove support",
      "1-year expiry",
      "50% savings",
    ],
  },
];

export default function CreditPurchase() {
  const navigate = useNavigate();
  const { balance } = useCredits();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async (
    packageId: string,
    credits: number,
    amount: number,
  ) => {
    setIsProcessing(true);

    try {
      // Generate a purchase session ID for tracking
      const purchaseSessionId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Ensure admin direct billing before processing payment
      const token = localStorage.getItem('supabase.auth.token');
      if (token) {
        try {
          await fetch('/api/credit-allocation/ensure-admin-billing', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              purchaseSessionId,
            }),
          });
        } catch (billingError) {
          console.warn('Failed to set admin direct billing:', billingError);
          // Continue with purchase - this is just a precaution
        }
      }

      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Add credits to user account (using the credit-system API that now ensures admin billing)
      if (token) {
        const response = await fetch('/api/credit-system/purchase', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            package_id: packageId,
            purchase_session_id: purchaseSessionId,
          }),
        });

        if (!response.ok) {
          throw new Error('Credit purchase failed');
        }
      } else {
        // Fallback to local credit system
        const packageInfo = creditPackages.find((p) => p.id === packageId);
        addCredits(
          credits,
          "purchase",
          `Credit purchase: ${packageInfo?.name || "Custom"} - $${amount} (Direct Admin Billing)`,
        );
      }

      toast.success(
        `Successfully purchased ${formatCredits(credits)} credits!`,
      );
      toast.info("Purchase billed directly to your admin account");
      navigate("/admin/projects");
    } catch (error) {
      toast.error("Payment failed. Please try again.");
      console.error("Payment error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomPurchase = () => {
    const credits = parseInt(customAmount);
    if (!credits || credits < 1000) {
      toast.error("Minimum purchase is 1,000 credits");
      return;
    }

    const amount = Math.round(credits * 0.003 * 100) / 100; // $0.003 per credit
    handlePurchase("custom", credits, amount);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Purchase Credits
            </h1>
            <p className="text-gray-600 mb-6">
              Choose the perfect credit package for your scanning needs
            </p>

            {/* Current Balance */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Current Balance: {formatCredits(balance.remaining)} credits
              </span>
            </div>
          </div>
        </div>

        {/* Credit Packages */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {creditPackages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative transition-all hover:shadow-lg cursor-pointer ${
                selectedPackage === pkg.id ? "ring-2 ring-blue-500" : ""
              } ${pkg.popular ? "border-blue-500" : ""}`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold">{pkg.name}</CardTitle>
                <p className="text-sm text-gray-600">{pkg.description}</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-gray-900">
                    ${pkg.price}
                  </div>
                  <div className="text-sm text-gray-500">
                    ${pkg.pricePerCredit.toFixed(4)} per credit
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCredits(pkg.credits)}
                  </div>
                  <div className="text-sm text-gray-500">credits</div>
                </div>

                <ul className="space-y-2 mb-6">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                  onClick={() => handlePurchase(pkg.id, pkg.credits, pkg.price)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Purchase Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Amount */}
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Custom Amount
            </CardTitle>
            <p className="text-sm text-gray-600">
              Need a different amount? Purchase custom credits at $0.003 per
              credit
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="custom-credits">Number of Credits</Label>
              <Input
                id="custom-credits"
                type="number"
                placeholder="Enter amount (minimum 1,000)"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min="1000"
                step="1000"
              />
            </div>

            {customAmount && parseInt(customAmount) >= 1000 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Credits:</span>
                  <span className="font-medium">
                    {formatCredits(parseInt(customAmount))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Cost:</span>
                  <span className="font-medium">
                    ${(parseInt(customAmount) * 0.003).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleCustomPurchase}
              disabled={
                !customAmount || parseInt(customAmount) < 1000 || isProcessing
              }
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Purchase Custom Amount
            </Button>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Why Choose Our Credits?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-1">
                Secure Payments
              </h4>
              <p className="text-sm text-gray-600">
                256-bit SSL encryption and PCI compliance
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-1">
                Instant Activation
              </h4>
              <p className="text-sm text-gray-600">
                Credits are added to your account immediately
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900 mb-1">No Expiry</h4>
              <p className="text-sm text-gray-600">
                Your credits never expire, use them when you need
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
