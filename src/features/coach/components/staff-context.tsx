"use client";

import { createContext, useContext, useMemo } from "react";
import { defaultStaff, staffOf, type Staff, type StaffFaces } from "../staff";

const StaffContext = createContext<Staff>(defaultStaff);

export function StaffProvider({
  faces,
  children,
}: {
  faces: StaffFaces;
  children: React.ReactNode;
}) {
  const { coach, medical, director, strategist, nutritionist } = faces;
  const staff = useMemo(
    () => staffOf({ coach, medical, director, strategist, nutritionist }),
    [coach, medical, director, strategist, nutritionist],
  );
  return <StaffContext value={staff}>{children}</StaffContext>;
}

export function useStaff() {
  return useContext(StaffContext);
}
