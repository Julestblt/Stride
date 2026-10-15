export default function PlanLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: React.ReactNode;
}) {
  return (
    <>
      {children}
      {session}
    </>
  );
}
