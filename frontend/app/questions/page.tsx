import type { Metadata } from "next";
import WhoSaidItBankBrowser from "../WhoSaidItBankBrowser";
import languageProfiles from "../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Quote Bank | Regulation Who Said It",
  description:
    "Browse the full Regulation Who Said It archive with host attribution, episode sources, timestamps, and context.",
};

export default function QuestionsPage() {
  return <WhoSaidItBankBrowser mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
