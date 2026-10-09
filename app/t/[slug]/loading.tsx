import { RecipientLoading } from "@/components/recipient/RecipientLoading";

/** Client navigations into /t/[slug]: the same calm paper as the first load (no layout shift). */
export default function Loading() {
  return <RecipientLoading />;
}
