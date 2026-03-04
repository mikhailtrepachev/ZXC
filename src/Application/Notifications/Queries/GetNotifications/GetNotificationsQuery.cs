using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Notifications.Queries.GetNotifications;

// Запрос, который возвращает список уведомлений
public record GetNotificationsQuery : IRequest<List<NotificationDto>>;

public class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, List<NotificationDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public GetNotificationsQueryHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<List<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var userId = _user.Id ?? throw new UnauthorizedAccessException("Token nebyl nalezen");

        // Ищем уведомления юзера, самые новые - сверху
        return await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.Created)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Message = n.Message,
                IsRead = n.IsRead,
                Created = n.Created
            })
            .ToListAsync(cancellationToken);
    }
}
