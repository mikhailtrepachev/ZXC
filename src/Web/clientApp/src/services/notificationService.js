import * as signalR from "@microsoft/signalr";

let connection = null;

export async function startNotificationSocket(onNotificationReceived) {
  if (connection) return;

  connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/notifications", { withCredentials: true })
    .withAutomaticReconnect()
    .build();

  connection.on("ReceiveNotification", (message) => {
    if (typeof onNotificationReceived === "function") {
      onNotificationReceived(message);
    }
  });

  try {
    await connection.start();
  } catch (error) {
    console.error("SignalR connection failed:", error);
    connection = null;
    setTimeout(() => startNotificationSocket(onNotificationReceived), 5000);
  }
}

export function stopNotificationSocket() {
  if (!connection) {
    return;
  }

  connection.stop();
  connection = null;
}
