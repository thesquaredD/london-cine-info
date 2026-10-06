import { initAnalytics } from "./lib/analytics";
import { render } from "preact";
import { App } from "./app";
import "./styles/base.css";
import "./styles/friends.css";

initAnalytics();

render(<App />, document.getElementById("app")!);
