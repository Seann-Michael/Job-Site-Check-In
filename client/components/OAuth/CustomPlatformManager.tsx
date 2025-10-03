import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Checkbox } from "../ui/checkbox";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Save,
  X,
  Info,
  Settings,
  Eye,
} from "lucide-react";
import { CustomPlatform, CustomPlatformField } from "../../types/oauth";

interface CustomPlatformManagerProps {
  onPlatformsUpdated?: () => void;
}

interface CustomPlatformFormProps {
  platform?: CustomPlatform;
  isOpen: boolean;
  onClose: () => void;
  onSave: (platform: Partial<CustomPlatform>) => void;
}

const fieldTypeOptions = [
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Long Text (Textarea)" },
  { value: "email", label: "Email Address" },
  { value: "url", label: "Website URL" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown (Select)" },
  { value: "checkbox", label: "Checkbox" },
];

const CustomPlatformForm: React.FC<CustomPlatformFormProps> = ({
  platform,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
    icon_url: "",
    fields: [] as CustomPlatformField[],
  });

  const [newField, setNewField] = useState<Partial<CustomPlatformField>>({
    type: "text",
    name: "",
    label: "",
    placeholder: "",
    required: false,
    options: [],
    description: "",
  });

  useEffect(() => {
    if (platform) {
      setFormData({
        name: platform.name,
        description: platform.description || "",
        instructions: platform.instructions,
        icon_url: platform.icon_url || "",
        fields: platform.fields,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        instructions: "",
        icon_url: "",
        fields: [],
      });
    }
  }, [platform, isOpen]);

  const addField = () => {
    if (!newField.label?.trim()) return;

    const field: CustomPlatformField = {
      id: `field_${Date.now()}`,
      name: newField.label
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""),
      type: newField.type as CustomPlatformField["type"],
      label: newField.label,
      placeholder: newField.placeholder || "",
      required: newField.required || false,
      options: newField.type === "select" ? newField.options : undefined,
      description: newField.description || "",
    };

    setFormData((prev) => ({
      ...prev,
      fields: [...prev.fields, field],
    }));

    setNewField({
      type: "text",
      name: "",
      label: "",
      placeholder: "",
      required: false,
      options: [],
      description: "",
    });
  };

  const removeField = (fieldId: string) => {
    setFormData((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== fieldId),
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.instructions.trim()) {
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {platform ? "Edit Custom Platform" : "Create Custom Platform"}
          </DialogTitle>
          <DialogDescription>
            Create a custom platform connection that clients can complete during
            onboarding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Platform Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Platform Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., CRM Integration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon_url">Icon URL (Optional)</Label>
                <Input
                  id="icon_url"
                  value={formData.icon_url}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      icon_url: e.target.value,
                    }))
                  }
                  placeholder="https://example.com/icon.png"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of what this platform does"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions for Client *</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    instructions: e.target.value,
                  }))
                }
                placeholder="Provide clear instructions for what the client needs to do or provide..."
                rows={4}
              />
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Custom Fields</h3>
            <p className="text-sm text-muted-foreground">
              Add fields that clients need to fill out to complete this platform
              connection.
            </p>

            {/* Existing Fields */}
            {formData.fields.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Current Fields</h4>
                <div className="space-y-2">
                  {formData.fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {
                              fieldTypeOptions.find(
                                (opt) => opt.value === field.type,
                              )?.label
                            }
                          </Badge>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {field.description}
                          </p>
                        )}
                        {field.options && field.options.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Options: {field.options.join(", ")}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Field */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3">Add New Field</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={newField.type}
                    onValueChange={(value) =>
                      setNewField((prev) => ({
                        ...prev,
                        type: value as CustomPlatformField["type"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Field Label</Label>
                  <Input
                    value={newField.label}
                    onChange={(e) =>
                      setNewField((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    placeholder="e.g., Account Username"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="space-y-2">
                  <Label>Placeholder Text</Label>
                  <Input
                    value={newField.placeholder}
                    onChange={(e) =>
                      setNewField((prev) => ({
                        ...prev,
                        placeholder: e.target.value,
                      }))
                    }
                    placeholder="Help text for the field"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newField.description}
                    onChange={(e) =>
                      setNewField((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Additional context for this field"
                  />
                </div>
              </div>

              {newField.type === "select" && (
                <div className="space-y-2 mb-3">
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={newField.options?.join("\n") || ""}
                    onChange={(e) =>
                      setNewField((prev) => ({
                        ...prev,
                        options: e.target.value
                          .split("\n")
                          .filter((opt) => opt.trim()),
                      }))
                    }
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="required"
                    checked={newField.required}
                    onCheckedChange={(checked) =>
                      setNewField((prev) => ({
                        ...prev,
                        required: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="required">Required field</Label>
                </div>
                <Button onClick={addField} disabled={!newField.label?.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.instructions.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {platform ? "Update Platform" : "Create Platform"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CustomPlatformManager: React.FC<CustomPlatformManagerProps> = ({
  onPlatformsUpdated,
}) => {
  const [platforms, setPlatforms] = useState<CustomPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] =
    useState<CustomPlatform | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchPlatforms();
  }, []);

  const fetchPlatforms = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const response = await fetch("/api/oauth/custom-platforms");
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.data || []);
      } else {
        console.warn("Custom platforms API not available");
        setPlatforms([]);
      }
    } catch (error) {
      console.error("Error fetching custom platforms:", error);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  };

  const savePlatform = async (platformData: Partial<CustomPlatform>) => {
    try {
      const method = selectedPlatform ? "PUT" : "POST";
      const url = selectedPlatform
        ? `/api/oauth/custom-platforms/${selectedPlatform.id}`
        : "/api/oauth/custom-platforms";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(platformData),
      });

      if (response.ok) {
        fetchPlatforms();
        onPlatformsUpdated?.();
        setSelectedPlatform(null);
      }
    } catch (error) {
      console.error("Error saving platform:", error);
    }
  };

  const deletePlatform = async (platformId: string) => {
    try {
      const response = await fetch(
        `/api/oauth/custom-platforms/${platformId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        fetchPlatforms();
        onPlatformsUpdated?.();
      }
    } catch (error) {
      console.error("Error deleting platform:", error);
    }
  };

  const handleEdit = (platform: CustomPlatform) => {
    setSelectedPlatform(platform);
    setShowForm(true);
  };

  const handleCreate = () => {
    setSelectedPlatform(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            Loading custom platforms...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Platforms</h3>
          <p className="text-sm text-muted-foreground">
            Create custom connection options for platforms not listed above
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Platform
        </Button>
      </div>

      {platforms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h4 className="font-medium mb-2">No Custom Platforms Yet</h4>
              <p className="text-sm mb-4">
                Create custom platform connections for services not in our
                standard list.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Custom Platform
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map((platform) => (
                <TableRow key={platform.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {platform.icon_url && (
                        <img
                          src={platform.icon_url}
                          alt={platform.name}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <div>
                        <div className="font-medium">{platform.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Created{" "}
                          {new Date(platform.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {platform.description || "No description"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {platform.fields.slice(0, 3).map((field) => (
                        <Badge
                          key={field.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {field.label}
                        </Badge>
                      ))}
                      {platform.fields.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{platform.fields.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={platform.is_active ? "default" : "secondary"}
                    >
                      {platform.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(platform)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deletePlatform(platform.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomPlatformForm
        platform={selectedPlatform}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setSelectedPlatform(null);
        }}
        onSave={savePlatform}
      />
    </div>
  );
};

export default CustomPlatformManager;
