import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, AlertCircle } from "lucide-react";

interface StreetViewProps {
  streetViewUrl?: string;
  hasStreetView?: boolean;
  address?: string;
  className?: string;
  title?: string;
  showCard?: boolean;
}

export const StreetView: React.FC<StreetViewProps> = ({
  streetViewUrl,
  hasStreetView = false,
  address,
  className = "",
  title = "Street View",
  showCard = true,
}) => {
  const handleOpenInGoogleMaps = () => {
    if (address) {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      window.open(googleMapsUrl, "_blank");
    }
  };

  const content = (
    <>
      {showCard && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {title}
            </CardTitle>
            {hasStreetView && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                Street View Available
              </Badge>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={showCard ? "" : "p-0"}>
        {hasStreetView && streetViewUrl ? (
          <div className="space-y-3">
            <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden border">
              <iframe
                src={streetViewUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Street View"
                className="absolute inset-0"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Interactive Street View of the project location
              </p>
              {address && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInGoogleMaps}
                  className="gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Maps
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="rounded-full bg-muted p-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-muted-foreground">
                Street View Not Available
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Street View imagery is not available for this location. This could be due to privacy restrictions or limited coverage.
              </p>
            </div>
            {address && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInGoogleMaps}
                className="gap-2"
              >
                <ExternalLink className="h-3 w-3" />
                View in Google Maps
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </>
  );

  if (showCard) {
    return (
      <Card className={className}>
        {content}
      </Card>
    );
  }

  return <div className={className}>{content}</div>;
};

export default StreetView;
