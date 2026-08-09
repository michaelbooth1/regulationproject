import type { Metadata } from "next";
import WhoSaidItGame from "../WhoSaidItGame";
import languageProfiles from "../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Who Said It? | Regulation Games",
  description:
    "Identify which Regulation host said ten funny, absurd lines pulled from a curated 30-quote transcript bank.",
};

export default function WhoSaidItPage() {
  return <WhoSaidItGame mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
