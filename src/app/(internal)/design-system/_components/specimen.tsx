import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { SectionHeader } from "@/components/stride/section-header";

export function GallerySection({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-8 flex-col gap-8 border-t border-border pt-10"
    >
      <header className="flex max-w-3xl flex-col gap-2">
        <MonoLabel tone="accent">{index}</MonoLabel>
        <h2 id={`${id}-title`} className="text-headline font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-body text-pretty text-muted">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

export function Specimen({
  title,
  meta,
  className,
  children,
}: {
  title: string;
  meta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      <SectionHeader as="h3" title={title} meta={meta} />
      {children}
    </div>
  );
}
