using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Cards.Commands.UpdateCardLimit;

public record UpdateCardLimitCommand : IRequest
{
    public int CardId { get; init; }
    public decimal DailyLimit { get; init; }
}

public class UpdateCardLimitCommandHandler : IRequestHandler<UpdateCardLimitCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public UpdateCardLimitCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateCardLimitCommand request, CancellationToken cancellationToken)
    {
        if (request.DailyLimit <= 0 || request.DailyLimit > 500000)
        {
            throw new Exception("Limit musi byt v rozsahu 1 az 500 000 Kc.");
        }

        string userId = _currentUser.Id ?? throw new UnauthorizedAccessException();

        Card? card = await _context.Cards
            .Include(c => c.Account)
            .FirstOrDefaultAsync(c => c.Id == request.CardId && c.Account.OwnerId == userId, cancellationToken);

        if (card is null)
        {
            throw new Exception("Karta nebyla nalezena.");
        }

        card.DailyLimit = Math.Round(request.DailyLimit, 0);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
