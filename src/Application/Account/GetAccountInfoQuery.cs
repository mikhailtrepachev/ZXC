using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Account;

public record GetAccountInfoQuery : IRequest<AccountDto>;

public class GetAccountInfoQueryHandler : IRequestHandler<GetAccountInfoQuery, AccountDto>
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

    public async Task<AccountDto> Handle(GetAccountInfoQuery request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // 1. Получаем данные клиента и счета (+ карты)
        var account = await _context.Accounts
            .FirstOrDefaultAsync(a => a.OwnerId == userId, cancellationToken);

        Client? client = await _context.Clients
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

        if (account == null || client == null) 
            throw new Exception("Data profile not found");

        string? userName = await _identityService.GetUserNameAsync(userId);

        return new AccountDto
        {
            FullName = userName ?? "Пользователь",
            Email = userName ?? string.Empty,
            AccountNumber = account.AccountNumber,
            Balance = account.Balance,
            DailyLimit = client.DailyTransferLimit,
        };
    }
}
