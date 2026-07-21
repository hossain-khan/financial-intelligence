import type { ButtonHTMLAttributes } from "react";

export interface ButtonProperties extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly isDisabled?: boolean;
}

export function Button({ disabled, isDisabled, ...properties }: ButtonProperties) {
  const unavailable = disabled === true || isDisabled === true;

  return (
    <button
      type="button"
      {...properties}
      disabled={unavailable}
      data-disabled={unavailable ? "true" : undefined}
    />
  );
}
