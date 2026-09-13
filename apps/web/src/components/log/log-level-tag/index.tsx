import { LOG_LEVEL, type LogLevel } from "@/services/types/log";
import { Tag } from "antd";

const LOG_LEVEL_COLOR: Record<LogLevel, string> = {
  [LOG_LEVEL.DEBUG]: "default",
  [LOG_LEVEL.INFO]: "blue",
  [LOG_LEVEL.WARN]: "gold",
  [LOG_LEVEL.ERROR]: "red",
  [LOG_LEVEL.FATAL]: "magenta",
};

interface ILogLevelTagProps {
  level: LogLevel;
}

export const LogLevelTag = ({ level }: ILogLevelTagProps) => {
  return (
    <Tag color={LOG_LEVEL_COLOR[level]} className="m-0 uppercase">
      {level}
    </Tag>
  );
};
