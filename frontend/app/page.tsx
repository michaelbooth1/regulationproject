import QuizApp from "./QuizApp";
import languageProfiles from "./data/host-language-profiles.json";


export default function Home() {
  return <QuizApp mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
