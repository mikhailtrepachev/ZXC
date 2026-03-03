using MediatR;
using Microsoft.EntityFrameworkCore; // <-- Это нужно для FirstOrDefaultAsync
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.UserSessions.Commands.CreateUserSession;

// 1. Сама Команда (остается без изменений)
public record CreateUserSessionCommand : IRequest<int>
{
    public string DeviceInfo { get; init; } = string.Empty;
    public string IpAddress { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
}

// 2. Наш обновленный "Умный" Обработчик
public class CreateUserSessionCommandHandler : IRequestHandler<CreateUserSessionCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public CreateUserSessionCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<int> Handle(CreateUserSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = _user.Id ?? throw new UnauthorizedAccessException("Token nebyl nalezen");

        // ШАГ 1: Ищем самую последнюю сессию этого пользователя в базе
        // Сортируем по Id по убыванию, чтобы первой оказалась самая свежая запись
        var lastSession = await _context.UserSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync(cancellationToken);

        // ШАГ 2: Проверяем на подозрительный вход (если это не самый первый вход юзера)
        if (lastSession != null)
        {
            // Если старый IP не равен новому IP ИЛИ старая локация не равна новой
            bool isSuspicious = lastSession.IpAddress != request.IpAddress ||
                                lastSession.Location != request.Location;

            if (isSuspicious)
            {
                // Создаем тревожное уведомление!
                var notification = new Notification
                {
                    UserId = userId,
                    Message = $"Podezřelý přístup! Zaznamenáno nové zařízení v: { request.Location } (IP: { request.IpAddress }). Předchozí přístup byl z: { lastSession.Location }.",
                    IsRead = false
                };

                // Добавляем уведомление в очередь на сохранение
                _context.Notifications.Add(notification);
            }
        }

        // ШАГ 3: Создаем новую сессию в любом случае
        var newSession = new UserSession
        {
            UserId = userId,
            DeviceInfo = request.DeviceInfo,
            IpAddress = request.IpAddress,
            Location = request.Location
        };

        _context.UserSessions.Add(newSession);

        // ШАГ 4: Сохраняем всё в базу данных (и новую сессию, и уведомление, если оно было)
        await _context.SaveChangesAsync(cancellationToken);

        return newSession.Id;
    }
}
