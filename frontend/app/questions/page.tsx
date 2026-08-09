import type { Metadata } from "next";
import QuestionBankBrowser from "../QuestionBankBrowser";
import languageProfiles from "../data/host-language-profiles.json";


export const metadata: Metadata = {
  title: "Question Bank | Regulation Quiz",
  description:
    "Browse every Regulation Quiz question and compare the Geoff, Andrew, Gavin, and Eric answers.",
};

export default function QuestionsPage() {
  return <QuestionBankBrowser mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
