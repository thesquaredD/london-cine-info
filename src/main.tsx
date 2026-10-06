import { render } from "preact";
import { App } from "./app";
import "./styles/base.css";
import "./styles/friends.css";

render(<App />, document.getElementById("app")!);
