import { ListStack } from "@/navigation/list-stack";

/** The Films stack: the list, the film detail pushed over it and the Filters sheet. */
export default function FilmsLayout() {
  return <ListStack scope="films" />;
}
