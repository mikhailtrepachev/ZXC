namespace ZxcBank.Domain.Entities;

public class Notification : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false; // По умолчанию уведомление непрочитанное
}
