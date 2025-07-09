import { App as AntdApp } from "antd";
import { Router } from "./router";

export const App = () => {
  return (
    <AntdApp>
      <Router />
    </AntdApp>
  );
};
