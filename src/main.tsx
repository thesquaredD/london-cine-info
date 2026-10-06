import { render } from "preact";
import { App } from "./app";
import "./styles/base.css";
import "./styles/friends-prototype.css";

render(<App />, document.getElementById("app")!);
