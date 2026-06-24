import { RewardScene } from "./components/RewardScene";
import { rewardConfig, type RewardDay } from "./config/rewardConfig";
import { StudyCompleteDemo } from "./examples/StudyCompleteDemo";

function readPreviewRewardDay(): RewardDay | null {
  const params = new URLSearchParams(window.location.search);
  const requestedDay = Number(params.get("rewardDay") ?? params.get("day"));

  if (requestedDay in rewardConfig) {
    return requestedDay as RewardDay;
  }

  const previewReward = params.get("previewReward");

  if (previewReward === "day7" || previewReward === "checkin-7") {
    return 7;
  }

  return null;
}

export default function App() {
  const previewRewardDay = readPreviewRewardDay();

  if (import.meta.env.DEV && previewRewardDay === null) {
    return <StudyCompleteDemo />;
  }

  return <RewardScene rewardDay={previewRewardDay ?? 1} />;
}
