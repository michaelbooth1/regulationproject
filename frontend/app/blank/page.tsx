import type { Metadata } from "next";
import FillBlankGame from "../FillBlankGame";
import languageProfiles from "../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Regulation Fill in the Blank",
  description:
    "Repair ten funny, absurd Regulation Podcast quotes by choosing the words missing from the transcript.",
};

export default function FillBlankPage() {
  return <FillBlankGame mappedEpisodes={languageProfiles.mappedEpisodes} />;
}

