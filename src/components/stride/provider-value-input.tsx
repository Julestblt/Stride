"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ProvenanceLabel } from "@/components/stride/provenance";

export function ProviderValueInput({
  id,
  providerValue,
  provenance,
  manualLabel = "Entered manually",
  unit,
  onValueChange,
  className,
  "aria-describedby": describedBy,
  ...props
}: Omit<
  React.ComponentProps<"input">,
  "id" | "value" | "defaultValue" | "onChange"
> & {
  id: string;
  providerValue: string;
  provenance: React.ReactNode;
  manualLabel?: string;
  unit?: string;
  onValueChange?: (value: string, source: "provider" | "manual") => void;
}) {
  const [value, setValue] = useState(providerValue);
  const [edited, setEdited] = useState(false);
  const source = edited ? "manual" : "provider";
  const sourceId = `${id}-source`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <InputGroup
        data-source={source}
        className={cn(!edited && "border-dashed")}
      >
        <InputGroupInput
          id={id}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setEdited(true);
            onValueChange?.(event.target.value, "manual");
          }}
          aria-describedby={[describedBy, sourceId].filter(Boolean).join(" ")}
          {...props}
        />
        {unit && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
      <ProvenanceLabel
        id={sourceId}
        source={source}
        aria-live="polite"
        className="self-start"
      >
        {edited ? manualLabel : provenance}
      </ProvenanceLabel>
    </div>
  );
}
