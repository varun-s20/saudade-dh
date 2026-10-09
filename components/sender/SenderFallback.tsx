import { Logo } from "@/components/ui/Logo";
import { PaperLoader } from "@/components/ui/PaperLoader";
import "./sender.css";

/**
 * Suspense fallback for the sender pages (the screens read the [token] param). Mirrors the
 * shell's frame without needing the token, so nothing jumps when the screen streams in.
 */
export function SenderFallback({ label = "Opening your envelope…" }: { label?: string }) {
  return (
    <div className="ss-page">
      <header className="ss-head phone-column">
        <Logo href={null} size="md" />
      </header>
      <main className="ss-main phone-column">
        <div className="grid min-h-[55dvh] place-items-center">
          <PaperLoader label={label} />
        </div>
      </main>
    </div>
  );
}
