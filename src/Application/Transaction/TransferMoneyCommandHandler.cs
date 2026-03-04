using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Transactions.Commands.TransferMoney;

public record TransferMoneyCommand : IRequest<int>
{
    public required string FromAccountNumber { get; init; }
    public required string ToAccountNumber { get; init; }
    public decimal Amount { get; init; }
    public string? Message { get; init; }
}

public class TransferMoneyCommandHandler : IRequestHandler<TransferMoneyCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly ICurrencyService _currencyService;

    public TransferMoneyCommandHandler(
        IApplicationDbContext context,
        IUser currentUser,
        ICurrencyService currencyService)
    {
        _context = context;
        _currentUser = currentUser;
        _currencyService = currencyService;
    }

    public async Task<int> Handle(TransferMoneyCommand request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            throw new Exception("Castka prevodu musi byt kladna.");
        }

        var userId = _currentUser.Id;
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException();
        }

        var senderAccount = await _context.Accounts
            .FirstOrDefaultAsync(
                a => a.AccountNumber == request.FromAccountNumber && a.OwnerId == userId,
                cancellationToken);

        if (senderAccount == null)
        {
            throw new Exception("Ucet pro odepsani nebyl nalezen nebo vam nepatri.");
        }

        if (senderAccount.IsFrozen)
        {
            throw new Exception("Vas ucet je zablokovan. Kontaktujte podporu.");
        }

        if (senderAccount.Balance < request.Amount)
        {
            throw new Exception("Na uctu neni dostatek prostredku.");
        }

        var receiverAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber, cancellationToken);

        if (receiverAccount == null)
        {
            throw new Exception("Ucet prijemce nebyl nalezen.");
        }

        if (receiverAccount.IsFrozen)
        {
            throw new Exception("Ucet prijemce je zablokovan.");
        }

        if (senderAccount.Id == receiverAccount.Id)
        {
            throw new Exception("Nelze prevadet penize sami sobe na stejny ucet.");
        }

        var normalizedMessage = (request.Message ?? string.Empty).Trim();
        if (normalizedMessage.Length > 140)
        {
            throw new Exception("Zprava k prevodu muze mit maximalne 140 znaku.");
        }

        var amountToDebit = request.Amount;
        var amountToCredit = request.Amount;

        var description = string.IsNullOrWhiteSpace(normalizedMessage)
            ? $"Prevod na {request.ToAccountNumber}"
            : $"Prevod na {request.ToAccountNumber}: {normalizedMessage}";

        if (senderAccount.Currency != receiverAccount.Currency)
        {
            amountToCredit = await _currencyService.ConvertAsync(
                request.Amount,
                senderAccount.Currency,
                receiverAccount.Currency);

            amountToCredit = Math.Round(amountToCredit, 2);
            description +=
                $" (Konverze: {request.Amount} {senderAccount.Currency} -> {amountToCredit} {receiverAccount.Currency})";
        }

        senderAccount.Balance -= amountToDebit;
        receiverAccount.Balance += amountToCredit;

        var transaction = new Domain.Entities.Transaction
        {
            FromAccountId = senderAccount.AccountNumber,
            ToAccountId = receiverAccount.AccountNumber,
            Amount = amountToDebit,
            Description = description,
        };

        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync(cancellationToken);

        return transaction.Id;
    }
}
