using MediatR;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.UserSessions.Commands.CreateUserSession;

// 1. Команда БЕЗ UserId. Фронтенд пришлет только инфу об устройстве.
public record CreateUserSessionCommand : IRequest<int>
{
    public string DeviceInfo { get; init; } = string.Empty;
    public string IpAddress { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
}

// 2. Обработчик, который сам достает ID из токена
public class CreateUserSessionCommandHandler : IRequestHandler<CreateUserSessionCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user; // <-- Инжектим сервис текущего юзера!

    public CreateUserSessionCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<int> Handle(CreateUserSessionCommand request, CancellationToken cancellationToken)
    {
        var entity = new UserSession
        {
            // Берем реальный ID из токена. Если токена нет - кидаем ошибку.
            UserId = _user.Id ?? throw new UnauthorizedAccessException("Токен не найден"),
            DeviceInfo = request.DeviceInfo,
            IpAddress = request.IpAddress,
            Location = request.Location
        };

        _context.UserSessions.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}
