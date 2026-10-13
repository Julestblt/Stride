"use client";

import {
  useDataActivityNavigation,
  DataActivityLink as Link,
} from "@/features/data-activity/components/navigation";
import { Search } from "lucide-react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  activitiesQuery,
  activityPageSize,
  activitySearchMaxLength,
  type ActivityFilter,
} from "../activities";

export function ActivitySearch({
  filter,
  search,
}: {
  filter: ActivityFilter;
  search: string;
}) {
  const navigate = useDataActivityNavigation();
  return (
    <form
      action="/activities"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const query = new URLSearchParams();
        for (const [name, value] of data) {
          if (typeof value === "string") query.set(name, value);
        }
        navigate(`/activities?${query.toString()}`);
      }}
      role="search"
      aria-label="Rechercher une activité par nom"
    >
      {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="activity-search" className="sr-only">
            Rechercher par nom
          </FieldLabel>
          <InputGroup className="h-11 lg:h-8">
            <InputGroupInput
              key={search}
              id="activity-search"
              name="q"
              type="search"
              defaultValue={search}
              maxLength={activitySearchMaxLength}
              placeholder="Rechercher par nom…"
            />
            <InputGroupAddon align="inline-end" className="py-0 pr-0">
              <InputGroupButton
                type="submit"
                size="icon-sm"
                className="size-11 lg:size-8"
                aria-label="Rechercher"
              >
                <Search />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {search && (
            <Link
              href={`/activities${activitiesQuery(filter, activityPageSize)}`}
              className="text-xs text-muted hover:text-foreground"
            >
              Effacer la recherche
            </Link>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
