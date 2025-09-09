import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_VARIABLES = [
  "city",
  "state",
  "zip",
  "neighborhood",
  "service",
  "business_name",
  "phone",
];

export default function TemplateEditor({
  value,
  onChange,
  variables = DEFAULT_VARIABLES,
}: {
  value: string;
  onChange: (v: string) => void;
  variables?: string[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const newValue = value.slice(0, start) + text + value.slice(end);
    onChange(newValue);

    // Set caret position after inserted text
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {variables.map((v) => (
          <Button key={v} size="sm" variant="outline" onClick={() => insertAtCursor(`{{${v}}}`)}>
            {'{' + v + '}'}
          </Button>
        ))}
      </div>
      <Textarea ref={textareaRef as any} value={value} onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)} className="h-56" />
    </div>
  );
}
