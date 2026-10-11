export function ChoiceRow({
  name,
  legend,
  options,
  value,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string | null;
}) {
  return (
    <fieldset className="border-b border-border py-4 last:border-b-0">
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
            />
            <span className="inline-flex min-h-10 items-center rounded-control border border-border-strong px-3 text-sm text-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
