using MassTransit;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Transaction;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Infrastructure.Consumers;

public class TransferMoneyConsumer : IConsumer<MoneyTransferredEvent>
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<TransferMoneyConsumer> _logger;
    private readonly INotificationService _notificationService;

    public TransferMoneyConsumer(
        IApplicationDbContext context, 
        ILogger<TransferMoneyConsumer> logger,
        INotificationService notificationService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task Consume(ConsumeContext<MoneyTransferredEvent> context)
    {
        MoneyTransferredEvent msg = context.Message;
        
        _logger.LogInformation("Sending notification about money transfer. Receiver: {ReceiverId}", msg.ReceiverId);

        string receiverMessage = $"{msg.Message}";

        Notification receiverNotification = new Notification
        {
            UserId = msg.ReceiverId,
            Message = receiverMessage,
            IsRead = false
        };

        _context.Notifications.Add(receiverNotification);

        string senderMessage = $"{msg.Message}";
        Notification senderNotification = new Notification
        {
            UserId = msg.SenderId,
            Message = senderMessage,
            IsRead = false
        };
        _context.Notifications.Add(senderNotification);

        await _context.SaveChangesAsync(context.CancellationToken);
        
        await _notificationService.SendNotificationToUserAsync(msg.ReceiverId, receiverMessage, context.CancellationToken);
        await _notificationService.SendNotificationToUserAsync(msg.SenderId, senderMessage, context.CancellationToken);
    }
}
