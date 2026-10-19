import { initAnalytics } from "./lib/analytics";
import { render } from "preact";
import { App } from "./app";
import "./styles/base.css";
import "./styles/prose.css";
import "./styles/friends.css";
import "./styles/picturehouse.css";
import "./styles/discovery.css";
import "./styles/changelog.css";
import "./styles/feedback.css";

import "./styles/discovery-designs.css";

document.documentElement.dataset.theme = "dark";
if (import.meta.env.VITE_DISCOVERY_DESIGNS !== "1") initAnalytics();
render(<App />, document.getElementById("app")!);
