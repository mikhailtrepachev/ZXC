//TODO: DODELAT'
import * as signalR from "@microsoft/signalr";
import { getAccessToken } from "./auth.js"; // Укажите правильный путь к вашему файлу из контекста

let connection = null;

export async function startNotificationSocket(onNotificationReceived) {
  // Если соединение уже есть, не создаем второе
  if (connection) return;

  const token = getAccessToken();
  if (!token) {
    console.warn("Нет токена доступа. Веб-сокет не запущен.");
    return;
  }

  // 1. Настраиваем подключение
  connection = new signalR.HubConnectionBuilder()
    // Укажите ВАШ реальный URL до бэкенда (например http://localhost:8080)
    .withUrl("http://localhost:8080/hubs/notifications", {
      // Это самое важное! Передаем токен для [Authorize] на бэкенде
      accessTokenFactory: () => getAccessToken() 
    })
    // Автоматически переподключаться, если сервер моргнул
    .withAutomaticReconnect() 
    .build();

  // 2. Слушаем событие, которое мы отправляем с бэкенда ("ReceiveNotification")
  connection.on("ReceiveNotification", (message) => {
    console.log("🔔 Получено PUSH уведомление:", message);
    
    // Передаем сообщение в UI (React/Vue компонент)
    if (typeof onNotificationReceived === "function") {
      onNotificationReceived(message);
    }
  });

  // 3. Запускаем соединение
  try {
    await connection.start();
    console.log("✅ SignalR подключен! Ожидаем уведомления...");
  } catch (err) {
    console.error("❌ Ошибка подключения SignalR: ", err);
    connection = null;
    
    // Пробуем переподключиться через 5 секунд, если бэкенд еще спит
    setTimeout(() => startNotificationSocket(onNotificationReceived), 5000);
  }
}

export function stopNotificationSocket() {
  if (connection) {
    connection.stop();
    connection = null;
    console.log("🛑 SignalR отключен.");
  }
}