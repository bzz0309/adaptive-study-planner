import { RewardScene } from "./components/RewardScene";
import { StudyCompleteDemo } from "./examples/StudyCompleteDemo";

export default function App() {
  if (import.meta.env.DEV) {
    return <StudyCompleteDemo />;
  }

  return <RewardScene rewardDay={1} />;
}
