using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Admin.Queries.GetAllUsers;

public record GetAllUsersQuery : IRequest<List<UserInfoDto>>;

public class GetAllUsersQueryHandler : IRequestHandler<GetAllUsersQuery, List<UserInfoDto>>
{
    private readonly IApplicationDbContext _context;

    public GetAllUsersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserInfoDto>> Handle(GetAllUsersQuery request, CancellationToken cancellationToken)
    {
        // Достаем клиентов и склеиваем имя с фамилией
        return await _context.Clients
            .Select(c => new UserInfoDto
            {
                UserId = c.UserId,
                FullName = c.FirstName + " " + c.LastName
            })
            .ToListAsync(cancellationToken);
    }
}
