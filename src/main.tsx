import { initAnalytics } from "./lib/analytics";
import { render } from "preact";
import { App } from "./app";
import "./styles/base.css";
import "./styles/friends.css";
import "./styles/picturehouse.css";
import "./styles/discovery.css";

document.documentElement.dataset.theme = "dark";
initAnalytics();
render(<App />, document.getElementById("app")!);
