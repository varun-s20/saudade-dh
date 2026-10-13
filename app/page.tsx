import { CoverStack } from "@/components/motion/CoverStack";
import { FirstTap, FourStamps, GoodToKnow, Hero, HowItWorks, Kept, Occasions, Wish } from "@/components/public/home/HomeSections";
import { PublicShell } from "@/components/public/PublicShell";

/**
 * S1: brand entry, told as a 1940s linen postcard ("Wish You Were Here", D-060). The order is a
 * story (D-074): what it is → why it matters → how it works → what goes inside → the moment they
 * open it → when people send one → how it keeps growing → answers. Colour bands alternate
 * (sky, sunset, cream, sea, sunset→cream, cream, seasons, cream), and the two pinned scroll
 * sequences never run back to back. The four stamps (sea) scroll up over how it works (D-078).
 */
export default function Home() {
  return (
    <PublicShell headTone="light">
      <Hero />
      <Wish />
      <CoverStack under={<HowItWorks />} over={<FourStamps />} />
      <FirstTap />
      <Occasions />
      <Kept />
      <GoodToKnow />
    </PublicShell>
  );
}
