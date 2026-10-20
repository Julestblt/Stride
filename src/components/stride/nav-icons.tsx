type NavIconProps = Omit<React.ComponentProps<"svg">, "viewBox" | "children">;

function NavSvg({
  size,
  ...props
}: NavIconProps & { size: 16 | 20; children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    />
  );
}

export function NavTodayIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <circle cx="8" cy="8" r="5.5" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

export function NavPlanIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M3 13V9 M6.5 13V5 M10 13V7 M13.5 13V3"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </NavSvg>
  );
}

export function NavActivitiesIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M1.5 8.5H4.5L6 4L9.5 12L11 8.5H14.5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function NavProgressIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M2.5 12L6.5 8L9 10.5L13.5 5 M10.5 5H13.5V8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function NavGearIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M1.5 11.5V8L5 7.5L7.5 9.5L13 10.5C14 10.7 14.5 11.3 14.5 12.5H1.5Z"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function NavNutritionIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M6 2H10 M7 2V6L3.6 12.4C3.3 13 3.7 14 4.4 14H11.6C12.3 14 12.7 13 12.4 12.4L9 6V2"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function NavRacesIcon(props: NavIconProps) {
  return (
    <NavSvg size={16} {...props}>
      <path
        d="M3.5 14V2.5 M3.5 3H12L10 6L12 9H3.5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function TabTodayIcon(props: NavIconProps) {
  return (
    <NavSvg size={20} {...props}>
      <circle cx="10" cy="10" r="7" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

export function TabPlanIcon(props: NavIconProps) {
  return (
    <NavSvg size={20} {...props}>
      <path
        d="M3 16V11 M7 16V7 M11 16V9 M15 16V4"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </NavSvg>
  );
}

export function TabActivitiesIcon(props: NavIconProps) {
  return (
    <NavSvg size={20} {...props}>
      <path
        d="M2 11H6L8 5L12 15L14 11H18"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}

export function TabProgressIcon(props: NavIconProps) {
  return (
    <NavSvg size={20} {...props}>
      <path
        d="M3 15L8 10L11 13L17 6 M13 6H17V10"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </NavSvg>
  );
}
