import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToolbarOutlineButton({
  className,
  ...props
}: ButtonProps) {
  return (
    <Button
      variant="outline"
      className={cn("h-9 gap-2", className)}
      {...props}
    />
  );
}
