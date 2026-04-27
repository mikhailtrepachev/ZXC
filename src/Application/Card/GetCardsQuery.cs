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
        var accounts = await _context.Accounts
            .Include(a => a.Cards)
            .AsNoTracking()
            .Where(a => a.OwnerId == userId)
            .ToListAsync(cancellationToken);

        if (accounts.Count == 0) return new List<CardDto>();

        return accounts
            .SelectMany(account => account.Cards.Select(c => new CardDto
            {
                Id = c.Id,
                MaskedNumber = c.CardNumber,
                HolderName = c.CardHolderName,
                ExpiryDate = c.ExpiryDate,
                Cvv = c.Cvv,
                AccountNumber = account.AccountNumber,
                IsVirtual = c.IsVirtual,
                IsActive = c.IsActive
            }))
            .OrderBy(c => c.Id)
            .ToList();
    }
}
