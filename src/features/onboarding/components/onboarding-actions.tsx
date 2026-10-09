import { cn } from "@/lib/utils";

export function OnboardingActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-5 mt-auto -mb-6 flex flex-col gap-3 border-t border-border bg-surface-inset px-5 pt-4 pb-7.5 lg:static lg:m-0 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0",
        className,
      )}
      {...props}
    />
  );
}
