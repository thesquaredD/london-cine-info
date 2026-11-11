import { ListStack } from "@/navigation/list-stack";

/** The Events stack: the agenda, the film detail pushed over it and the Filters sheet. */
export default function EventsLayout() {
  return <ListStack scope="events" />;
}
