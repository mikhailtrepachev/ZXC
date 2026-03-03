using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Constants;
using ZxcBank.Domain.Enums;
using MediatR;
using ZxcBank.Application.Common.Models; // Не забудьте этот using для IRequestHandler

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
        // 1. Создаем пользователя в Identity (Login/Password)
        (Result result, string userId) = await _identityService.CreateUserAsync(request.Email, request.Password);

        if (!result.Succeeded)
        {
            throw new Exception($"Registration error: {string.Join(", ", result.Errors)}");
        }

        // 2. Выдаем роль
        await _identityService.AddToRoleAsync(userId, Roles.Client); 

        // 3. Создаем профиль Клиента
        var clientEntity = new Client
        {
            UserId = userId,
            DailyTransferLimit = 10000,
            InternetPaymentLimit = 5000
        };

        // 4. Генерируем счета и КЛАДЕМ ИХ ВНУТРЬ КЛИЕНТА
        // EF Core сам поймет, что эти счета принадлежат этому клиенту и проставит ClientId
        var accounts = CreateAccounts(userId);
        
        foreach (var account in accounts)
        {
            clientEntity.Accounts.Add(account);
        }

        // 5. Добавляем только Клиента (счета добавятся каскадно)
        _context.Clients.Add(clientEntity);
        
        await _context.SaveChangesAsync(cancellationToken);

        return userId;
    }
    
    private List<Domain.Entities.Account> CreateAccounts(string userId)
    {
        var accounts = new List<Domain.Entities.Account>();

        // CZK (Koruna)
        accounts.Add(new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(),
            // Name убрали
            Balance = 0,
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Koruna
        });

        // USD
        accounts.Add(new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(),
            Balance = 0,
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Dollar
        });
        
        // EUR
        accounts.Add(new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(),
            Balance = 0,
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Euro
        });
        
        // Investment (CZK)
        accounts.Add(new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(),
            Balance = 0,
            IsFrozen = false,
            Type = AccountType.Investment, // <-- Фронт поймет по этому полю, что это инвест-счет
            Currency = Currency.Koruna
        });

        return accounts;
    }

    private string GenerateAccountNumber()
    {
        Random random = new Random();
        string part1 = random.Next(100000, 999999).ToString();
        string part2 = random.Next(100000, 999999).ToString();
         
        return $"40817{part1}{part2}"; 
    }
}
