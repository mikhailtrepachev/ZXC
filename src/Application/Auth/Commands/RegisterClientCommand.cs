using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Constants;
using ZxcBank.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Models; // Не забудьте этот using для IRequestHandler

namespace ZxcBank.Application.Auth.Commands;

public record RegisterClientCommand : IRequest<string>
{
    public required string Email { get; init; }
    public required string Password { get; init; }
    
    public required string FirstName { get; init; }
    
    public required string LastName { get; init; }
    
    public required string PhoneNumber { get; init; }
    
    public required string State { get; init; }
    
    public required string Street { get; init; }
}

public class RegisterClientCommandHandler : IRequestHandler<RegisterClientCommand, string>
{
    private readonly IIdentityService _identityService;
    private readonly IApplicationDbContext _context;
    private readonly ILogger<RegisterClientCommandHandler> _logger;

    public RegisterClientCommandHandler(IIdentityService identityService, IApplicationDbContext context, ILogger<RegisterClientCommandHandler> logger)
    {
        _identityService = identityService;
        _context = context;
        _logger = logger;
    }

    public async Task<string> Handle(RegisterClientCommand request, CancellationToken cancellationToken)
    {
        // 1. Создаем пользователя в Identity (Login/Password)
        (Result result, string userId) = await _identityService.CreateUserAsync(request.Email, request.Password);

        if (!result.Succeeded)
        {
            _logger.LogError("Registration failed: {Errors}", string.Join(", ", result.Errors));   
            throw new Exception($"Registration error: {string.Join(", ", result.Errors)}");
        }

        // 2. Выдаем роль
        await _identityService.AddToRoleAsync(userId, Roles.Client); 

        // 3. Создаем профиль Клиента
        Client clientEntity = new Client
        {
            UserId = userId,
            
            DailyTransferLimit = 10000,
            InternetPaymentLimit = 5000,
            
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhoneNumber = request.PhoneNumber,
            State = request.State,
            Street = request.Street
        };

        // 4. Генерируем счета и КЛАДЕМ ИХ ВНУТРЬ КЛИЕНТА
        // EF Core сам поймет, что эти счета принадлежат этому клиенту и проставит ClientId
        List<Domain.Entities.Account> accounts = CreateAccounts(userId);
        
        foreach (Domain.Entities.Account account in accounts)
        {
            clientEntity.Accounts.Add(account);
        }

        // 5. Добавляем только Клиента (счета добавятся каскадно)
        _context.Clients.Add(clientEntity);
        
        _logger.LogInformation("User {UserId} registered", userId);
        
        await _context.SaveChangesAsync(cancellationToken);

        return userId;
    }
    
    private List<Domain.Entities.Account> CreateAccounts(string userId)
    {
        List<Domain.Entities.Account> accounts = new List<Domain.Entities.Account>();

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
