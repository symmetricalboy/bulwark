import * as React from "react";
import { cn } from "@/lib/utils";
import { IconContrastContext } from "@/contexts/icon-contrast-context";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const isSolid =
      variant === "default" ||
      variant === "destructive" ||
      className?.includes("bg-primary") ||
      className?.includes("bg-destructive");

    const content = isSolid ? (
      <IconContrastContext.Provider value={{ inheritColor: true }}>
        {children}
      </IconContrastContext.Provider>
    ) : (
      children
    );

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            default:
              "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow [&_svg]:text-current",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            outline:
              "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            destructive:
              "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm [&_svg]:text-current",
          }[variant],
          {
            sm: "h-9 px-3 text-sm",
            md: "h-10 px-4 py-2",
            lg: "h-11 px-8",
            icon: "h-10 w-10",
          }[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };