using Microsoft.AspNetCore.SignalR;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Web.Hubs;

namespace ZxcBank.Web.Services;

public class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public SignalRNotificationService(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendNotificationToUserAsync(string userId, string message, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.User(userId).SendAsync("ReceiveNotification", message, cancellationToken);
    }
}
