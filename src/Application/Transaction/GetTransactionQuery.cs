using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

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
        if (userId == null) throw new UnauthorizedAccessException();

        // 1. ИСПРАВЛЕНИЕ: Получаем список НОМЕРОВ счетов (string), а не ID (int)
        List<string> userAccountNumbers = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.OwnerId == userId)
            .Select(a => a.AccountNumber) // <--- БЕРЕМ AccountNumber (строка)
            .ToListAsync(cancellationToken);

        if (!userAccountNumbers.Any()) return new List<TransactionDto>();

        // 2. Теперь типы совпадают: List<string> и t.FromAccountId (string)
        var transactions = await _context.Transactions
            .AsNoTracking()
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .Where(t => userAccountNumbers.Contains(t.FromAccountId) || 
                        userAccountNumbers.Contains(t.ToAccountId))
            .OrderByDescending(t => t.Created)
            .Take(20)
            .ToListAsync(cancellationToken);

        // 3. Маппим в DTO
        var result = new List<TransactionDto>();

        foreach (var t in transactions)
        {
            // Проверяем по строке (номеру счета)
            bool isIncome = userAccountNumbers.Contains(t.ToAccountId!);

            result.Add(new TransactionDto
            {
                Id = t.Id,
                Date = t.Created.DateTime,
                Amount = t.Amount,
                Type = isIncome ? TransactionType.Income : TransactionType.Expense,
                
                CounterpartyAccount = isIncome 
                    ? t.FromAccountId ?? "Bankomat"  // Берем само поле, раз оно хранит номер
                    : t.ToAccountId ?? "Neznámé",
                
                Description = t.Description
            });
        }

        return result;
    }
}
