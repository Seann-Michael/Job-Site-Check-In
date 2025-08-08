# Google Street View Integration

This document describes the Google Street View functionality that has been integrated into the project management system.

## Overview

The system now automatically captures Google Street View imagery during project creation and displays it in the project detail view, optimized to avoid repeated API calls.

## Features

### 1. Automatic Street View URL Generation

- When an address is selected in **Add Project**, the system automatically:
  - Checks if Street View is available for that location
  - Generates a Street View embed URL if available
  - Stores the URL in the project data

### 2. Visual Indicators

- ✅ **Green badge**: "Address verified with Google Maps"
- 🔵 **Blue badge**: "Street View available for this location"
- ⚠️ **Amber badge**: "Street View not available for this location"

### 3. Street View Display in Project Detail

- Displays an interactive Street View iframe when available
- Shows a fallback message when Street View is not available
- Includes a "Open in Google Maps" button for additional exploration

## Technical Implementation

### New Functions in `client/lib/googleMaps.ts`

```typescript
// Generate Street View embed URL
createStreetViewEmbedUrl(location, options): string

// Check if Street View is available for a location
checkStreetViewAvailability(location): Promise<boolean>
```

### New Components

**`client/components/StreetView.tsx`**

- Displays Street View iframe or fallback message
- Handles "Open in Google Maps" functionality
- Responsive design for mobile and desktop

### Updated Components

**`client/pages/AddProject.tsx`**

- Auto-generates Street View URL during address selection
- Displays Street View availability status
- Stores Street View data in project object

**`client/pages/ProjectDetail.tsx`**

- Displays Street View component below the map
- Uses stored URL to avoid repeated API calls

## Data Structure

### New Project Fields

```typescript
interface Project {
  // ... existing fields
  streetViewUrl?: string; // Stored embed URL
  hasStreetView?: boolean; // Availability flag
  streetAddress?: string; // Individual address components
  city?: string;
  state?: string;
  zipCode?: string;
}
```

## Performance Optimization

### API Call Efficiency

- ✅ Street View URL generated **once** during project creation
- ✅ URL stored in project data for reuse
- ✅ No additional API calls when viewing projects
- ✅ Street View availability checked only once

### Caching Strategy

- Street View URLs are stored permanently with project data
- No expiration handling needed (Google embed URLs are stable)
- Project data includes availability flag to avoid unnecessary checks

## User Experience

### Project Creation Flow

1. User searches for an address
2. System verifies address with Google Maps
3. System checks Street View availability in the background
4. Visual indicators show the user what's available
5. Street View URL is generated and stored

### Project Viewing Flow

1. User opens project details
2. Street View loads immediately from stored URL
3. No API calls or loading delays
4. Fallback shown if Street View wasn't available

## Error Handling

### Street View Not Available

- Graceful fallback with informative message
- "Open in Google Maps" button as alternative
- No impact on other project functionality

### API Failures

- System continues to work without Street View
- Error logging for debugging
- User sees standard project view without Street View

## Browser Compatibility

- Uses standard iframe embed (supported by all modern browsers)
- Mobile responsive design
- Touch-friendly controls on mobile devices

## Security Considerations

- Uses official Google Maps Embed API
- No direct API key exposure in URLs
- HTTPS-only iframe sources
- Referrer policy configured for privacy

## Future Enhancements

### Potential Improvements

- [ ] Custom Street View positioning (heading, pitch, FOV)
- [ ] Street View thumbnail generation for project cards
- [ ] Historical Street View imagery options
- [ ] 360° virtual tour integration

### Configuration Options

- [ ] Enable/disable Street View per project type
- [ ] Custom Street View parameters
- [ ] Fallback imagery options

## Usage Examples

### Creating a Project with Street View

```typescript
// Address selection automatically triggers Street View generation
handleAddressSelect(selectedPlace) => {
  // ... address parsing
  const hasStreetView = await checkStreetViewAvailability({lat, lng});
  const streetViewUrl = hasStreetView ? createStreetViewEmbedUrl({lat, lng}) : "";
  // ... store in project data
}
```

### Displaying Street View

```tsx
<StreetView
  streetViewUrl={project.streetViewUrl}
  hasStreetView={project.hasStreetView}
  address={project.address}
/>
```

## Testing

### Test Addresses

- **Available**: "1600 Amphitheatre Parkway, Mountain View, CA" (Google HQ)
- **Available**: "Times Square, New York, NY"
- **Limited**: Rural or private road addresses
- **Not Available**: Military bases, private properties

### Verification Steps

1. Create project with test address
2. Verify Street View indicators appear
3. Save project and navigate to project detail
4. Confirm Street View displays without additional loading
5. Test "Open in Google Maps" functionality

This integration provides a professional, efficient way to display location context for projects while maintaining optimal performance through smart caching strategies.
