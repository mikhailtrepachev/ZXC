namespace ZxcBank.Application.Common.Interfaces;

public interface INotificationService
{
    Task SendNotificationToUserAsync(string userId, string message, CancellationToken cancellationToken = default);
}
