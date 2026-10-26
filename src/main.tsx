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
import "./styles/nearby.css";
import "./styles/posters.css";
import "./styles/welcome.css";

document.documentElement.dataset.theme = "dark";
initAnalytics();
// Replace the readable programme for everyone alike when the interactive app starts.
document.getElementById("static-content")?.remove();
render(<App />, document.getElementById("app")!);
