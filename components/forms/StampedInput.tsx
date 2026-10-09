"use client";

/**
 * <StampedInput>: a labelled line on a postcard form. Typewriter label, a ruled writing line
 * that inks in on focus, optional handwritten prefix ("Dear"), hint, error and a counter slot.
 * Accessible: <label for>, aria-describedby → hint + error, aria-invalid, error in a live region.
 * `className` styles the field wrapper; `inputClassName` the <input>.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils/cn";
import { IconWarning } from "@/components/ui/icons";
import "./forms.css";

export type FieldFont = "display" | "hand" | "ui";

export interface StampedFieldBaseProps {
  label: ReactNode;
  /** Visually hide the label (still announced). */
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Plain, clear error text. Marks the field invalid. */
  error?: string | null;
  /** Right side of the label row, e.g. "42 / 120". Use FieldCounter for the standard look. */
  counter?: ReactNode;
  /** Typeface of what the person writes. Default "display" (the UI face, a size up). */
  font?: FieldFont;
  /** Small handwritten word before the line, e.g. "Dear". Decorative. */
  prefix?: ReactNode;
  className?: string;
}

export interface StampedInputProps extends StampedFieldBaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "className"> {
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/** "42 / 120" counter that turns red when over the limit. */
export function FieldCounter({ count, max }: { count: number; max: number }) {
  return (
    <span className="sd-field__counter" data-over={count > max}>
      {count} / {max}
    </span>
  );
}

/** Shared ids/aria wiring for StampedInput and StampedTextarea. */
export function useFieldIds(id: string | undefined, hint: ReactNode, error: string | null | undefined, describedBy?: string) {
  const auto = useId();
  const fieldId = id ?? `f${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedby = cn(describedBy, hint ? hintId : null, error ? errorId : null) || undefined;
  return { fieldId, hintId, errorId, describedby };
}

export function FieldShell({
  fieldId,
  label,
  hideLabel,
  counter,
  hint,
  hintId,
  error,
  errorId,
  disabled,
  className,
  ruled,
  children,
}: {
  fieldId: string;
  label: ReactNode;
  hideLabel?: boolean;
  counter?: ReactNode;
  hint?: ReactNode;
  hintId: string;
  error?: string | null;
  errorId: string;
  disabled?: boolean;
  className?: string;
  ruled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("sd-field", ruled && "sd-field--ruled", className)}
      data-invalid={error ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <div className={cn("sd-field__head", hideLabel && !counter && "sr-only")}>
        <label htmlFor={fieldId} className={cn("sd-field__label", hideLabel && "sr-only")}>
          {label}
        </label>
        {counter}
      </div>
      {children}
      {hint && (
        <p id={hintId} className="sd-field__hint">
          {hint}
        </p>
      )}
      <div aria-live="polite">
        {error && (
          <p id={errorId} className="sd-field__error">
            <IconWarning size={16} />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function StampedInput({
  label,
  hideLabel,
  hint,
  error,
  counter,
  font = "display",
  prefix,
  className,
  inputClassName,
  id,
  disabled,
  ref,
  "aria-describedby": describedBy,
  ...rest
}: StampedInputProps) {
  const ids = useFieldIds(id, hint, error, describedBy);
  return (
    <FieldShell
      fieldId={ids.fieldId}
      label={label}
      hideLabel={hideLabel}
      counter={counter}
      hint={hint}
      hintId={ids.hintId}
      error={error}
      errorId={ids.errorId}
      disabled={disabled}
      className={className}
    >
      <div className="sd-field__line">
        {prefix && (
          <span className="sd-field__prefix" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={ref}
          id={ids.fieldId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedby}
          className={cn("sd-field__control", `sd-field__control--${font}`, inputClassName)}
        />
      </div>
    </FieldShell>
  );
}
