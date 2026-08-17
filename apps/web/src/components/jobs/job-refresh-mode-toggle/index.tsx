import {
  JOB_REFRESH_MODE,
  type JobRefreshMode,
} from "@/services/types/job";
import { Segmented } from "antd";

interface IJobRefreshModeToggleProps {
  mode: JobRefreshMode;
  onChange: (mode: JobRefreshMode) => void;
}

export const JobRefreshModeToggle = ({
  mode,
  onChange,
}: IJobRefreshModeToggleProps) => {
  return (
    <Segmented<JobRefreshMode>
      value={mode}
      options={[
        { label: "SSE", value: JOB_REFRESH_MODE.SSE },
        { label: "Polling", value: JOB_REFRESH_MODE.POLLING },
      ]}
      onChange={onChange}
    />
  );
};
