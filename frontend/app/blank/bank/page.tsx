import type { Metadata } from "next";
import FillBlankBankBrowser from "../../FillBlankBankBrowser";
import languageProfiles from "../../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Fill in the Blank Bank | Regulation Who Said It",
  description:
    "Review all 60 Regulation Fill in the Blank questions, accepted answers, and transcript sources.",
};

export default function FillBlankBankPage() {
  return <FillBlankBankBrowser mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
