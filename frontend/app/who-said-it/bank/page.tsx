import type { Metadata } from "next";
import WhoSaidItBankBrowser from "../../WhoSaidItBankBrowser";
import languageProfiles from "../../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Who Said It Quote Bank | Regulation Games",
  description:
    "Browse the full 30-quote Who Said It bank with host attribution, episode sources, timestamps, and context.",
};

export default function WhoSaidItBankPage() {
  return <WhoSaidItBankBrowser mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
