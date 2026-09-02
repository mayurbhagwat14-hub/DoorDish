import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@food/utils/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#FF5A1F] text-white hover:bg-[#E64A0F] shadow-[0_4px_14px_rgba(255,90,31,0.25)] hover:shadow-[0_6px_20px_rgba(255,90,31,0.35)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-[#F0E8E4] bg-white text-[#1A1A1A] shadow-xs hover:bg-[#FFF7F2] hover:border-[#FF5A1F]/30 hover:text-[#FF5A1F]",
        secondary:
          "bg-[#FFF0EB] text-[#FF5A1F] hover:bg-[#FFE0D6] font-bold",
        ghost:
          "hover:bg-[#FFF0EB] hover:text-[#FF5A1F]",
        link: "text-[#FF5A1F] underline-offset-4 hover:underline",
        green: "bg-[#3DB54A] text-white hover:bg-[#2E9639] shadow-sm",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4 text-sm",
        sm: "h-8 rounded-full gap-1.5 px-3.5 text-xs has-[>svg]:px-2.5",
        lg: "h-12 rounded-full px-8 text-base has-[>svg]:px-6",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
