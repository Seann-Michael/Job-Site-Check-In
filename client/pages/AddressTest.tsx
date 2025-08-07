import { useState } from "react";
import { AddressAutocomplete } from "@/components/GoogleMaps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";

export default function AddressTest() {
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState({ lat: "", lng: "" });

  return (
    <AppLayout>
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Address Autocomplete Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressAutocomplete
              label="Test Address Input"
              placeholder="Type an address (e.g., 123 Main Street)"
              value={address}
              onChange={(newAddress, placeResult) => {
                setAddress(newAddress);
                if (placeResult) {
                  setCoordinates({
                    lat: placeResult.lat.toString(),
                    lng: placeResult.lng.toString()
                  });
                }
              }}
            />
            
            {coordinates.lat && coordinates.lng && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h3 className="font-medium text-green-800">Selected Address:</h3>
                <p className="text-green-700">{address}</p>
                <p className="text-green-600 text-sm">
                  Coordinates: {coordinates.lat}, {coordinates.lng}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
