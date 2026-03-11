using MassTransit;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Notifications.Events;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Infrastructure.Consumers;

public class SuspiciousActivityConsumer : IConsumer<SuspiciousActivityDetectedEvent>
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<SuspiciousActivityConsumer> _logger;
    private readonly INotificationService _notificationService;

    public SuspiciousActivityConsumer(IApplicationDbContext context, ILogger<SuspiciousActivityConsumer> logger, INotificationService notificationService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task Consume(ConsumeContext<SuspiciousActivityDetectedEvent> context)
    {
        SuspiciousActivityDetectedEvent message = context.Message;
        
        _logger.LogInformation("Creating a notification for user {UserId} with IP {Ip}", message.UserId, message.NewIpAddress);

        Notification notification = new Notification
        {
            UserId = message.UserId,
            Message =
                $"Podezřelý přístup! Zaznamenáno nové zařízení v: {message.NewLocation} (IP: {message.NewIpAddress}). Předchozí přístup byl z: {message.OldLocation}.",
            IsRead = false
        };

        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync(context.CancellationToken);
        
        await _notificationService.SendNotificationToUserAsync(message.UserId, notification.Message, context.CancellationToken);
    }
}
