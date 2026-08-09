import type { Metadata } from "next";
import WhoSaidItGame from "../WhoSaidItGame";
import languageProfiles from "../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Regulation Who Said It",
  description:
    "Identify which Regulation Podcast host said ten funny, absurd lines pulled from a curated 60-quote transcript bank.",
};

export default function WhoSaidItPage() {
  return <WhoSaidItGame mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
