const london = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function londonTime(time: number): {
  date: string;
  time: string;
  minute: number;
  band: string;
} {
  const parts = Object.fromEntries(
    london.formatToParts(time).map((part) => [part.type, part.value]),
  );
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minute,
    band: minute < 12 * 60 ? "morning" : minute < 17 * 60 ? "afternoon" : "evening",
  };
}
