namespace ZxcBank.Application.Notifications.Queries.GetNotifications;

public class NotificationDto
{
    public int Id { get; init; }
    public string Message { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public DateTimeOffset Created { get; init; } 
}
