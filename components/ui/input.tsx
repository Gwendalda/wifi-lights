import * as React from "react";
import { TextField } from "@radix-ui/themes";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: "1" | "2" | "3";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "2", ...props }, ref) => {
    return (
      <TextField.Root size={size}>
        <TextField.Slot>
          <input
            type={type}
            className={cn(
              "w-full",
              className
            )}
            ref={ref}
            {...props}
          />
        </TextField.Slot>
      </TextField.Root>
    );
  }
);
Input.displayName = "Input";

export { Input }; 