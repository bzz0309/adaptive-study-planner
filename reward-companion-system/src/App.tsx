import { HomeDashboard } from "./components/HomeDashboard";
import { RewardScene } from "./components/RewardScene";
import { rewardConfig, type RewardDay } from "./config/rewardConfig";

function readPreviewRewardDay(): RewardDay | null {
  const params = new URLSearchParams(window.location.search);
  const rewardDayParam = params.get("rewardDay");

  if (rewardDayParam !== null) {
    const requestedDay = Number(rewardDayParam);

    if (requestedDay in rewardConfig) {
      return requestedDay as RewardDay;
    }
  }

  if (!import.meta.env.DEV) {
    return null;
  }

  const debugDay = Number(params.get("day"));

  if (debugDay in rewardConfig) {
    return debugDay as RewardDay;
  }

  const previewReward = params.get("previewReward");

  if (previewReward === "day7" || previewReward === "checkin-7") {
    return 7;
  }

  return null;
}

export default function App() {
  const previewRewardDay = readPreviewRewardDay();

  if (previewRewardDay === null) {
    return <HomeDashboard />;
  }

  return <RewardScene rewardDay={previewRewardDay} />;
}
