"use server";

import { fetchFlightsFromAviationStack } from "@/lib/aviationstack";

export async function getCommuteFlights(input: {
  origin: string;
  destination: string;
  date: string; // keep for future; timetable uses "today" but we'll use this later
}) {
  const origin = input.origin.toUpperCase();
  const destination = input.destination.toUpperCase();

  // MVP: timetable gives "today" schedule. We'll improve date handling next.
  const flights = await fetchFlightsFromAviationStack(origin, destination, input.date);

  return flights;
}
