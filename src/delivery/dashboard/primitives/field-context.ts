import { createContext, useContext } from "react";

export type FieldControl = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
};

export const FieldContext = createContext<FieldControl | null>(null);

export type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * The props a control needs to be announced with its label, its hint, and its
 * error. A control rendered outside a Field gets nothing back, which is the
 * honest answer: it has to carry its own aria-label.
 */
export function useFieldProps(): FieldControlProps {
  const field = useContext(FieldContext);
  if (!field) {
    return {};
  }
  return {
    id: field.id,
    ...(field.describedBy ? { "aria-describedby": field.describedBy } : {}),
    ...(field.invalid ? { "aria-invalid": true } : {}),
  };
}
