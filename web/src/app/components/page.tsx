import type { Metadata } from "next";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Components · InVin" };

export default function ComponentsPage() {
  return <Showcase />;
}
