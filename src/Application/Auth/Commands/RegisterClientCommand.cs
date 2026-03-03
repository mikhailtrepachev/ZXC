using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Constants;
using ZxcBank.Application.Common.Models;

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
        (Result result, string userId) = await _identityService.CreateUserAsync(request.Email, request.Password);

        if (!result.Succeeded)
        {
            string errors = string.Join(", ", result.Errors);
            throw new Exception($"Registration error: {errors}");
        }

        await _identityService.AddToRoleAsync(userId, Roles.Client); 

        Client clientEntity = new Client
        {
            UserId = userId,
            DailyTransferLimit = 10000,
            InternetPaymentLimit = 5000
        };

        _context.Clients.Add(clientEntity);
        
        var newAccount = new Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(), // Генерируем красивый номер
            Balance = 0, // Стартовый баланс
            IsFrozen = false
        };
        
        _context.Accounts.Add(newAccount);

        await _context.SaveChangesAsync(cancellationToken);

        return userId;
    }
    
    private string GenerateAccountNumber()
    {
        Random random = new Random();
        string part1 = random.Next(100000, 999999).ToString();
        string part2 = random.Next(100000, 999999).ToString();
        
        return $"40817810{part1}{part2}"; // Итого 20 цифр
    }
}
