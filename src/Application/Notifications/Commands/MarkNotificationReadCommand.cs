using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Notifications.Commands;

public record MarkNotificationReadCommand(int NotificationId) : IRequest;

public class MarkNotificationReadCommandHandler : IRequestHandler<MarkNotificationReadCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public MarkNotificationReadCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        string userId = _currentUser.Id ?? throw new UnauthorizedAccessException();

        Notification? notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == request.NotificationId && n.UserId == userId, cancellationToken);

        if (notification is null)
        {
            throw new Exception("Notifikace nebyla nalezena.");
        }

        notification.IsRead = true;
        await _context.SaveChangesAsync(cancellationToken);
    }
}

public record MarkAllNotificationsReadCommand : IRequest;

public class MarkAllNotificationsReadCommandHandler : IRequestHandler<MarkAllNotificationsReadCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public MarkAllNotificationsReadCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        string userId = _currentUser.Id ?? throw new UnauthorizedAccessException();

        List<Notification> notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(cancellationToken);

        foreach (Notification notification in notifications)
        {
            notification.IsRead = true;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
