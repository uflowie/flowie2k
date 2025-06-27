import AdvancedAudioPlayer from "./AdvancedAudioPlayer";
import "./App.css";
import VanillaFrontend from "./VanillaFrontend";

function App() {

  return (
    <>
      <VanillaFrontend />
      <AdvancedAudioPlayer songId={1} />
    </>
  );
}

export default App;
