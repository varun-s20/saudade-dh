"use client";

/**
 * <StampedTextarea>: the multi-line sibling of StampedInput. With font="hand" + ruled it is the
 * letter's writing surface: the pen face (Nanum Pen Script) on faint ruled lines spaced exactly one line apart, the lines
 * scrolling with the text. `autoGrow` grows the field with its content (no inner scrollbar).
 */
import { useCallback, useLayoutEffect, useRef, type ChangeEvent, type Ref, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldShell, useFieldIds, type StampedFieldBaseProps } from "./StampedInput";
import "./forms.css";

export interface StampedTextareaProps extends StampedFieldBaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix" | "className"> {
  /** Faint ruled lines behind the text, one per line. */
  ruled?: boolean;
  /** Grow with the content instead of scrolling. */
  autoGrow?: boolean;
  textareaClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function StampedTextarea({
  label,
  hideLabel,
  hint,
  error,
  counter,
  font = "display",
  prefix,
  className,
  textareaClassName,
  id,
  disabled,
  ruled,
  autoGrow,
  rows = 4,
  onChange,
  ref,
  value,
  "aria-describedby": describedBy,
  ...rest
}: StampedTextareaProps) {
  const ids = useFieldIds(id, hint, error, describedBy);
  const inner = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = el;
    },
    [ref],
  );

  const fit = useCallback(() => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow]);

  // Size to the initial/controlled value before paint.
  useLayoutEffect(fit, [fit, value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    fit();
  };

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
      ruled={ruled}
    >
      <div className="sd-field__line">
        {prefix && (
          <span className="sd-field__prefix" aria-hidden>
            {prefix}
          </span>
        )}
        <textarea
          {...rest}
          ref={setRefs}
          id={ids.fieldId}
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedby}
          className={cn("sd-field__control", `sd-field__control--${font}`, autoGrow && "overflow-hidden", textareaClassName)}
        />
      </div>
    </FieldShell>
  );
}
