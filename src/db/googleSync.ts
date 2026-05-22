import { getAccessToken, setCalendarExpired } from "./firebase";

async function googleApiFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      console.warn("Google API returned 401. Setting calendar session as expired.");
      setCalendarExpired(true);
      return null;
    }
    return res;
  } catch (err) {
    console.error("Network error during Google API invocation:", err);
    return null;
  }
}

/**
 * ----------------------------------------------------
 * GOOGLE TASKS API CALLS
 * ----------------------------------------------------
 */

export async function createGoogleTask(title: string): Promise<string | null> {
  try {
    const response = await googleApiFetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: title || "New Task",
        notes: "From Daily Post-it"
      })
    });

    if (!response || !response.ok) return null;
    const data = await response.json();
    return data.id || null;
  } catch (err) {
    console.error("Error creating Google Task:", err);
    return null;
  }
}

export async function updateGoogleTask(calendarTaskId: string, title: string, completed: boolean): Promise<boolean> {
  try {
    const response = await googleApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${calendarTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({
        id: calendarTaskId,
        title: title || "New Task",
        status: completed ? "completed" : "needsAction"
      })
    });

    return !!(response && response.ok);
  } catch (err) {
    console.error("Error updating Google Task:", err);
    return false;
  }
}

export async function deleteGoogleTask(calendarTaskId: string): Promise<boolean> {
  try {
    const response = await googleApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${calendarTaskId}`, {
      method: "DELETE"
    });

    return !!(response && response.ok);
  } catch (err) {
    console.error("Error deleting Google Task:", err);
    return false;
  }
}

/**
 * ----------------------------------------------------
 * GOOGLE CALENDAR EVENTS API CALLS (For Timed Tasks)
 * ----------------------------------------------------
 */

export async function createGoogleEvent(
  dayId: string,
  title: string,
  timeStr: string,
  reminderMinutes: number
): Promise<string | null> {
  try {
    // Construct local Date-Time string, e.g. "2026-05-22T14:30:00"
    const localDateTimeStr = `${dayId}T${timeStr}:00`;
    const startDate = new Date(localDateTimeStr);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default to 1 hour duration

    const response = await googleApiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      body: JSON.stringify({
        summary: title || "Timed Task",
        description: "Task set with alert on Daily Post-it workspace.",
        start: {
          dateTime: startDate.toISOString()
        },
        end: {
          dateTime: endDate.toISOString()
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: reminderMinutes }
          ]
        }
      })
    });

    if (!response || !response.ok) return null;
    const data = await response.json();
    return data.id || null;
  } catch (err) {
    console.error("Error creating Google Calendar Event:", err);
    return null;
  }
}

export async function updateGoogleEvent(
  calendarEventId: string,
  dayId: string,
  title: string,
  timeStr: string,
  reminderMinutes: number,
  completed: boolean
): Promise<boolean> {
  try {
    const localDateTimeStr = `${dayId}T${timeStr}:00`;
    const startDate = new Date(localDateTimeStr);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const finalSummary = completed ? `✔ ${title}` : title;

    const response = await googleApiFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
      method: "PUT",
      body: JSON.stringify({
        summary: finalSummary,
        description: "Task set with alert on Daily Post-it workspace.",
        start: {
          dateTime: startDate.toISOString()
        },
        end: {
          dateTime: endDate.toISOString()
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: reminderMinutes }
          ]
        }
      })
    });

    return !!(response && response.ok);
  } catch (err) {
    console.error("Error updating Google Calendar Event:", err);
    return false;
  }
}

export async function deleteGoogleEvent(calendarEventId: string): Promise<boolean> {
  try {
    const response = await googleApiFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
      method: "DELETE"
    });

    return !!(response && response.ok);
  } catch (err) {
    console.error("Error deleting Google Calendar Event:", err);
    return false;
  }
}
