import WhoSaidItGame from "./WhoSaidItGame";
import languageProfiles from "./data/host-language-profiles.json";


export default function Home() {
  return <WhoSaidItGame mappedEpisodes={languageProfiles.mappedEpisodes} />;
}
