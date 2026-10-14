"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { maskFrenchDate } from "@/features/onboarding/dates";

export function FrenchDateInput({
  id,
  name,
  required = false,
}: {
  id: string;
  name: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      placeholder="JJ/MM/AAAA"
      pattern="\d{2}/\d{2}/\d{4}"
      required={required}
      value={value}
      onChange={(event) => setValue(maskFrenchDate(event.target.value))}
    />
  );
}
