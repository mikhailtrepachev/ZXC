using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Transaction;

public record GetTransferRecipientQuery(string AccountNumber) : IRequest<TransferRecipientDto?>;

public class TransferRecipientDto
{
    public string AccountNumber { get; set; } = string.Empty;
    public string HolderFirstName { get; set; } = string.Empty;
    public string HolderLastName { get; set; } = string.Empty;
    public string HolderFullName { get; set; } = string.Empty;
}

public class GetTransferRecipientQueryHandler : IRequestHandler<GetTransferRecipientQuery, TransferRecipientDto?>
{
    private readonly IApplicationDbContext _context;

    public GetTransferRecipientQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<TransferRecipientDto?> Handle(
        GetTransferRecipientQuery request,
        CancellationToken cancellationToken)
    {
        var normalized = (request.AccountNumber ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var account = await _context.Accounts
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.AccountNumber == normalized, cancellationToken);

        if (account == null)
        {
            return null;
        }

        var client = await _context.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == account.OwnerId, cancellationToken);

        var firstName = client?.FirstName?.Trim() ?? string.Empty;
        var lastName = client?.LastName?.Trim() ?? string.Empty;
        var fullName = $"{firstName} {lastName}".Trim();

        return new TransferRecipientDto
        {
            AccountNumber = account.AccountNumber,
            HolderFirstName = firstName,
            HolderLastName = lastName,
            HolderFullName = string.IsNullOrWhiteSpace(fullName) ? "Neznamy prijemce" : fullName,
        };
    }
}
