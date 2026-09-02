import * as React from "react"

import { cn } from "@food/utils/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (props, ref) => {
    const { className, type, value, ...restProps } = props
    
    // Ensure value is always a string (never undefined/null) when provided
    const safeValue = value == null ? "" : String(value)
    
    const hasValueProp = "value" in props
    const inputProps = hasValueProp
      ? { ...restProps, value: safeValue }
      : restProps
    
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground text-[#1A1A1A] placeholder:text-[#6B6B6B]/60 border-[#F0E8E4] h-10 w-full min-w-0 rounded-xl border bg-white px-4 py-2 text-sm shadow-xs transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-[#FF5A1F] focus-visible:ring-[#FF5A1F]/20 focus-visible:ring-3",
          "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
          className
        )}
        {...inputProps}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
