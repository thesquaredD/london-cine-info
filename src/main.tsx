import { initAnalytics } from "./lib/analytics";
import { render } from "preact";
import { App } from "./app";
import { applyPosterReview } from "./lib/poster-review";
import "./styles/base.css";
import "./styles/prose.css";
import "./styles/friends.css";
import "./styles/picturehouse.css";
import "./styles/discovery.css";
import "./styles/changelog.css";
import "./styles/feedback.css";
import "./styles/nearby.css";
import "./styles/posters.css";

document.documentElement.dataset.theme = "dark";
applyPosterReview(document.documentElement, location.search);
initAnalytics();
render(<App />, document.getElementById("app")!);
