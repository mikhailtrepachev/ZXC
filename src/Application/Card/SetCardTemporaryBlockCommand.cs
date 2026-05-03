using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Cards.Commands.SetCardTemporaryBlock;

public record SetCardTemporaryBlockCommand : IRequest
{
    public int CardId { get; init; }
    public bool Blocked { get; init; }
}

public class SetCardTemporaryBlockCommandHandler : IRequestHandler<SetCardTemporaryBlockCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public SetCardTemporaryBlockCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(SetCardTemporaryBlockCommand request, CancellationToken cancellationToken)
    {
        string userId = _currentUser.Id ?? throw new UnauthorizedAccessException();

        Card? card = await _context.Cards
            .Include(c => c.Account)
            .FirstOrDefaultAsync(c => c.Id == request.CardId && c.Account.OwnerId == userId, cancellationToken);

        if (card is null)
        {
            throw new Exception("Karta nebyla nalezena.");
        }

        if (!card.IsActive && !request.Blocked)
        {
            throw new Exception("Kartu zablokovanou bankou nelze odblokovat klientem.");
        }

        card.IsTemporarilyBlocked = request.Blocked;
        await _context.SaveChangesAsync(cancellationToken);
    }
}
