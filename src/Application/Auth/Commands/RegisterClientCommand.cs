using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Constants; // Убедись, что тут есть Roles.Client
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Auth.Commands;

public record RegisterClientCommand : IRequest<string>
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}

public class RegisterClientCommandHandler : IRequestHandler<RegisterClientCommand, string>
{
    private readonly IIdentityService _identityService;
    private readonly IApplicationDbContext _context;

    public RegisterClientCommandHandler(IIdentityService identityService, IApplicationDbContext context)
    {
        _identityService = identityService;
        _context = context;
    }

    public async Task<string> Handle(RegisterClientCommand request, CancellationToken cancellationToken)
    {
        // 1. Создаем технического пользователя (Identity)
        var (result, userId) = await _identityService.CreateUserAsync(request.Email, request.Password);

        if (!result.Succeeded)
        {
            // Собираем ошибки (например, "Пароль слишком простой")
            var errors = string.Join(", ", result.Errors);
            throw new Exception($"Registration error: {errors}");
        }

        // 2. Выдаем ему роль "Client" (чтобы работала авторизация)
        // Убедись, что метод AddToRoleAsync есть в IIdentityService
        await _identityService.AddToRoleAsync(userId, Roles.Client); 

        // 3. Создаем бизнес-сущность "Client" (твоя таблица)
        var clientEntity = new Client
        {
            UserId = userId,
            DailyTransferLimit = 10000, // Дефолтный лимит для новичков
            InternetPaymentLimit = 5000
        };

        _context.Clients.Add(clientEntity);

        await _context.SaveChangesAsync(cancellationToken);

        return userId;
    }
}
