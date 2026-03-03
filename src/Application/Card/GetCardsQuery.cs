using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Card;

namespace ZxcBank.Application.Cards.Queries.GetCards;

public record GetCardsQuery : IRequest<List<CardDto>>;

public class GetCardsQueryHandler : IRequestHandler<GetCardsQuery, List<CardDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public GetCardsQueryHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<List<CardDto>> Handle(GetCardsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.Id;

        // Ищем счет и сразу карты
        var account = await _context.Accounts
            .Include(a => a.Cards)
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.OwnerId == userId, cancellationToken);

        if (account == null) return new List<CardDto>();

        return account.Cards.Select(c => new CardDto
        {
            Id = c.Id,
            // Показываем только хвост
            MaskedNumber = "**** **** **** " + c.CardNumber.Substring(c.CardNumber.Length - 4),
            HolderName = c.CardHolderName,
            ExpiryDate = c.ExpiryDate,
            Cvv = c.Cvv,
            IsVirtual = c.IsVirtual,
            IsActive = c.IsActive
        }).ToList();
    }
}
