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
        var userId = _currentUser.Id;
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException();
        }

        var userAccountNumbers = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.OwnerId == userId)
            .Select(a => a.AccountNumber)
            .ToListAsync(cancellationToken);

        if (!userAccountNumbers.Any())
        {
            return new List<TransactionDto>();
        }

        var transactions = await _context.Transactions
            .AsNoTracking()
            .Where(t => userAccountNumbers.Contains(t.FromAccountId) || userAccountNumbers.Contains(t.ToAccountId))
            .OrderByDescending(t => t.Created)
            .Take(100)
            .ToListAsync(cancellationToken);

        var result = new List<TransactionDto>(transactions.Count);

        foreach (var transaction in transactions)
        {
            var fromAccountNumber = transaction.FromAccountId ?? string.Empty;
            var toAccountNumber = transaction.ToAccountId ?? string.Empty;
            var isIncome = userAccountNumbers.Contains(toAccountNumber);

            result.Add(new TransactionDto
            {
                Id = transaction.Id,
                Date = transaction.Created.DateTime,
                Amount = transaction.Amount,
                Type = isIncome ? TransactionType.Income : TransactionType.Expense,
                CounterpartyAccount = isIncome ? fromAccountNumber : toAccountNumber,
                FromAccountNumber = fromAccountNumber,
                ToAccountNumber = toAccountNumber,
                Description = transaction.Description,
            });
        }

        return result;
    }
}
