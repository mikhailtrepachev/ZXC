using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Account;

public record GetAccountInfoQuery : IRequest<ClientProfileDto>;

public class GetAccountInfoQueryHandler : IRequestHandler<GetAccountInfoQuery, ClientProfileDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser; // Сервис для получения ID из токена
    private readonly IIdentityService _identityService;

    public GetAccountInfoQueryHandler(IApplicationDbContext context, IUser currentUser, IIdentityService identityService)
    {
        _context = context;
        _currentUser = currentUser;
        _identityService = identityService;
    }

    public async Task<Account.ClientProfileDto> Handle(GetAccountInfoQuery request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // 1. Получаем Клиента (для лимитов)
        Client? client = await _context.Clients
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

        if (client == null) 
            throw new Exception("Profile not found. (Client entity is missing)");

        // 2. Получаем ВСЕ счета пользователя (List)
        // Используем Where + ToListAsync вместо FirstOrDefaultAsync
        List<Domain.Entities.Account> accounts = await _context.Accounts
            .AsNoTracking() // Для чтения быстрее
            .Where(a => a.OwnerId == userId)
            .OrderBy(a => a.Id) // Можно сортировать, например, по ID
            .ToListAsync(cancellationToken);

        // 3. Получаем имя пользователя
        string? userName = await _identityService.GetUserNameAsync(userId);

        string fullName;

        if (!string.IsNullOrEmpty(client.FirstName) || !string.IsNullOrEmpty(client.LastName))
        {
            fullName = $"{client.LastName} {client.FirstName}".Trim();
        } 
        else
        {
            fullName = "User";
        }

        return new Account.ClientProfileDto
        {
            FullName = fullName,
            Email = userName ?? string.Empty,

            DailyTransferLimit = client.DailyTransferLimit,
            InternetPaymentLimit = client.InternetPaymentLimit,

            Accounts = accounts.Select(a => new AccountItemDto
            {
                Id = a.Id,
                AccountNumber = a.AccountNumber,
                Balance = a.Balance,
                Currency = a.Currency.ToString(),
                Type = a.Type.ToString(),
                IsFrozen = a.IsFrozen
            }).ToList()
        };
    }
    
    public class AccountItemDto
    {
        public int Id { get; set; }
        public string AccountNumber { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public string Currency { get; set; } = string.Empty; // "RUB", "USD"
        public string Type { get; set; } = string.Empty;     // "Debet", "Investment"
        public bool IsFrozen { get; set; }
    }
}
