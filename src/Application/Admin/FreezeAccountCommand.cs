using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Account;

public record FreezeAccountCommand : IRequest
{
    public int AccountId { get; init; }
    public bool Freeze { get; init; } // true = заморозить, false = разморозить
}

public class FreezeAccountCommandHandler : IRequestHandler<FreezeAccountCommand>
{
    private readonly IApplicationDbContext _context;

    public FreezeAccountCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(FreezeAccountCommand request, CancellationToken cancellationToken)
    {
        Domain.Entities.Account? account = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Id == request.AccountId, cancellationToken);

        if (account == null) throw new Exception("Счет не найден");

        // Меняем статус
        account.IsFrozen = request.Freeze;

        await _context.SaveChangesAsync(cancellationToken);
    }
}
