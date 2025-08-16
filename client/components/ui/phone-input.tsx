import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  autoComplete?: string;
}

export function PhoneInput({
  value = "",
  onChange,
  onBlur,
  placeholder = "(555) 123-4567",
  disabled = false,
  className,
  id,
  name,
  required = false,
  autoComplete = "tel",
  ...props
}: PhoneInputProps) {
  const [error, setError] = useState<string>("");
  const [touched, setTouched] = useState(false);

  // Format phone number as user types
  const formatPhoneNumber = (phoneNumber: string): string => {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, "");

    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);

    // Format based on length
    if (limited.length === 0) return "";
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6)
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  // Get just the digits from formatted phone
  const getDigitsOnly = (phoneNumber: string): string => {
    return phoneNumber.replace(/\D/g, "");
  };

  // Validate phone number
  const validatePhone = (phoneNumber: string): string => {
    const digits = getDigitsOnly(phoneNumber);

    if (!digits && !required) return "";
    if (!digits && required) return "Phone number is required";
    if (digits.length > 0 && digits.length < 10) {
      return "Phone number must be 10 digits";
    }
    if (digits.length > 10) return "Phone number cannot exceed 10 digits";

    return "";
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatPhoneNumber(inputValue);
    const digits = getDigitsOnly(formatted);

    // Update error if touched
    if (touched) {
      setError(validatePhone(formatted));
    }

    // Call onChange with both formatted and digits
    onChange?.(formatted);
  };

  // Handle blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    setError(validatePhone(value));
    onBlur?.(e);
  };

  // Validate on value change from parent
  useEffect(() => {
    if (touched && value !== undefined) {
      setError(validatePhone(value));
    }
  }, [value, touched, required]);

  // Get validation state
  const isValid = !error;
  const hasError = touched && !!error;

  return (
    <div className="space-y-1">
      <Input
        type="tel"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          className,
          hasError && "border-destructive focus:border-destructive",
          isValid && touched && value && "border-green-500",
        )}
        id={id}
        name={name}
        autoComplete={autoComplete}
        {...props}
      />
      {hasError && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {isValid && touched && value && getDigitsOnly(value).length === 10 && (
        <p className="text-sm text-green-600">&#10003; Valid phone number</p>
      )}
    </div>
  );
}

// Hook for phone validation
export function usePhoneValidation(phone: string, required: boolean = false) {
  const getDigitsOnly = (phoneNumber: string): string => {
    return phoneNumber.replace(/\D/g, "");
  };

  const validatePhone = (
    phoneNumber: string,
  ): { isValid: boolean; error: string } => {
    const digits = getDigitsOnly(phoneNumber);

    if (!digits && !required) return { isValid: true, error: "" };
    if (!digits && required)
      return { isValid: false, error: "Phone number is required" };
    if (digits.length > 0 && digits.length < 10) {
      return { isValid: false, error: "Phone number must be 10 digits" };
    }
    if (digits.length > 10)
      return { isValid: false, error: "Phone number cannot exceed 10 digits" };

    return { isValid: true, error: "" };
  };

  const formatPhoneNumber = (phoneNumber: string): string => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    const limited = cleaned.slice(0, 10);

    if (limited.length === 0) return "";
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6)
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  return {
    ...validatePhone(phone),
    formatPhoneNumber,
    getDigitsOnly,
    digitsCount: getDigitsOnly(phone).length,
  };
}

export default PhoneInput;
