using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.UserSessions.Queries.GetUserSessions;

// Запрос, который вернет список (List) наших DTO
public record GetUserSessionsQuery : IRequest<List<UserSessionDto>>;

public class GetUserSessionsQueryHandler : IRequestHandler<GetUserSessionsQuery, List<UserSessionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public GetUserSessionsQueryHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<List<UserSessionDto>> Handle(GetUserSessionsQuery request, CancellationToken cancellationToken)
    {
        // 1. Узнаем, кто делает запрос
        var userId = _user.Id ?? throw new UnauthorizedAccessException("Token nebyl nalezen");

        // 2. Достаем его сессии из базы, сортируем новые сверху и превращаем в DTO
        return await _context.UserSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Created) // Самые свежие входы будут первыми
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
