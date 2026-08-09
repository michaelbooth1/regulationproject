import type { Metadata } from "next";
import WhoSaidItBankBrowser from "../../WhoSaidItBankBrowser";
import languageProfiles from "../../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Quote Bank | Regulation Who Said It",
  description:
    "Browse the full 60-quote Regulation Who Said It bank with host attribution, episode sources, timestamps, and context.",
};

export default function WhoSaidItBankPage() {
  return <WhoSaidItBankBrowser mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
