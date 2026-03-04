using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.UserSessions.Queries.GetUserSessions; // Берем DTO отсюда

namespace ZxcBank.Application.UserSessions.Queries.GetUserLogsForAdmin;

// В отличие от обычного юзера, админ передает ID того, чьи логи он хочет посмотреть
public record GetUserLogsForAdminQuery(string TargetUserId) : IRequest<List<UserSessionDto>>;

public class GetUserLogsForAdminQueryHandler : IRequestHandler<GetUserLogsForAdminQuery, List<UserSessionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUserLogsForAdminQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserSessionDto>> Handle(GetUserLogsForAdminQuery request, CancellationToken cancellationToken)
    {
        // Ищем логи конкретного TargetUserId
        return await _context.UserSessions
            .Where(s => s.UserId == request.TargetUserId)
            .OrderByDescending(s => s.Created)
            .Select(s => new UserSessionDto
            {
                Id = s.Id,
                DeviceInfo = s.DeviceInfo,
                IpAddress = s.IpAddress,
                Location = s.Location,
                Created = s.Created
            })
            .ToListAsync(cancellationToken);
    }
}
