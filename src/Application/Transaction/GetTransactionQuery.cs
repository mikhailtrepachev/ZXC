using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Enums;

namespace ZxcBank.Application.Transaction;

public record GetTransactionsQuery : IRequest<List<TransactionDto>>;

public class GetTransactionsQueryHandler : IRequestHandler<GetTransactionsQuery, List<TransactionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public GetTransactionsQueryHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<List<TransactionDto>> Handle(GetTransactionsQuery request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        
        // 1. Находим ID нашего счета
        Domain.Entities.Account? myAccount = await _context.Accounts
            .AsNoTracking() // Ускорение для чтения
            .FirstOrDefaultAsync(a => a.OwnerId == userId, cancellationToken);

        if (myAccount == null) return new List<TransactionDto>();

        // 2. Ищем все транзакции, где мы отправитель ИЛИ получатель
        var transactions = await _context.Transactions
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .Where(t => t.FromAccountId == myAccount.AccountNumber || t.ToAccountId == myAccount.AccountNumber)
            .OrderByDescending(t => t.Created) // Сначала новые
            .Take(20) // Ограничим 20 последними (для хакатона хватит)
            .ToListAsync(cancellationToken);

        // 3. Превращаем в DTO
        List<TransactionDto> result = new List<TransactionDto>();

        foreach (var t in transactions)
        {
            bool isIncome = t.ToAccountId == myAccount.AccountNumber; // Если получатель - мы, значит доход

            result.Add(new TransactionDto
            {
                Id = t.Id,
                Date = t.Created.DateTime,
                Amount = t.Amount,
                Type = isIncome ? TransactionType.Income : TransactionType.Expense,
                CounterpartyAccount = isIncome 
                    ? t.FromAccount?.AccountNumber ?? "Банкомат" 
                    : t.ToAccount?.AccountNumber ?? "Неизвестно",
                Description = t.Description
            });
        }

        return result;
    }
}
