using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Transaction;

public record GetConversionEstimateQuery : IRequest<ConversionEstimateDto>
{
    public required string FromAccountNumber { get; init; }
    public required string ToAccountNumber { get; init; }
    public decimal Amount { get; init; }
}

public class ConversionEstimateDto
{
    public string FromAccountNumber { get; set; } = string.Empty;
    public string ToAccountNumber { get; set; } = string.Empty;
    public string FromCurrency { get; set; } = string.Empty;
    public string ToCurrency { get; set; } = string.Empty;
    public decimal AmountFrom { get; set; }
    public decimal AmountTo { get; set; }
    public decimal ConversionRate { get; set; }
}

public class GetConversionEstimateQueryHandler : IRequestHandler<GetConversionEstimateQuery, ConversionEstimateDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly ICurrencyService _currencyService;

    public GetConversionEstimateQueryHandler(
        IApplicationDbContext context,
        IUser currentUser,
        ICurrencyService currencyService)
    {
        _context = context;
        _currentUser = currentUser;
        _currencyService = currencyService;
    }

    public async Task<ConversionEstimateDto> Handle(GetConversionEstimateQuery request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            throw new Exception("Castka konverze musi byt kladna.");
        }

        var userId = _currentUser.Id;
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException();
        }

        var fromAccount = await _context.Accounts
            .AsNoTracking()
            .FirstOrDefaultAsync(
                a => a.OwnerId == userId && a.AccountNumber == request.FromAccountNumber,
                cancellationToken);

        if (fromAccount == null)
        {
            throw new Exception("Zdrojovy ucet nebyl nalezen.");
        }

        var toAccount = await _context.Accounts
            .AsNoTracking()
            .FirstOrDefaultAsync(
                a => a.OwnerId == userId && a.AccountNumber == request.ToAccountNumber,
                cancellationToken);

        if (toAccount == null)
        {
            throw new Exception("Cilovy ucet nebyl nalezen.");
        }

        if (fromAccount.AccountNumber == toAccount.AccountNumber)
        {
            throw new Exception("Pro konverzi vyberte jiny cilovy ucet.");
        }

        if (fromAccount.IsFrozen || toAccount.IsFrozen)
        {
            throw new Exception("Jeden z vybranych uctu je zablokovany.");
        }

        decimal amountTo;
        if (fromAccount.Currency == toAccount.Currency)
        {
            amountTo = request.Amount;
        }
        else
        {
            amountTo = await _currencyService.ConvertAsync(
                request.Amount,
                fromAccount.Currency,
                toAccount.Currency);
        }

        amountTo = Math.Round(amountTo, 2);
        var rate = request.Amount == 0 ? 0 : Math.Round(amountTo / request.Amount, 6);

        return new ConversionEstimateDto
        {
            FromAccountNumber = fromAccount.AccountNumber,
            ToAccountNumber = toAccount.AccountNumber,
            FromCurrency = fromAccount.Currency.ToString(),
            ToCurrency = toAccount.Currency.ToString(),
            AmountFrom = request.Amount,
            AmountTo = amountTo,
            ConversionRate = rate,
        };
    }
}
